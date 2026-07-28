import {
  CACHE_KEY_PREFIX,
  getBumpKey,
  getCacheNamespace,
  getTagKey,
  hasRedisEnv,
  TAG_TTL_HARD_SECONDS,
  TAG_TTL_SOFT_SECONDS,
} from "./keySchema";
import type { KvClient } from "./types";

interface Logger {
  error: (obj: Record<string, unknown>) => void;
}

// Aligned with Next.js internal CacheEntry shape
// (next/dist/server/lib/cache-handlers/types)
interface CacheEntry {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
}

interface StoredEntry {
  entry: CacheEntry;
  bytes: Uint8Array | null;
}

// Aligned with Next.js CacheHandler interface
interface CacheHandler {
  get(cacheKey: string, softTags: string[]): Promise<CacheEntry | undefined>;
  set(cacheKey: string, pendingEntry: Promise<CacheEntry>): Promise<void>;
  refreshTags(): Promise<void>;
  getExpiration(tags: string[]): Promise<number>;
  updateTags(tags: string[], durations?: { expire?: number }): Promise<void>;
}

interface CreateDistributedCacheHandlerOptions {
  appName: string;
  // KV client (Upstash Redis-compatible), supplied by the host app's shim.
  // This package declares no Redis dependency of its own: Next loads a cache
  // handler outside the app's module graph, so anything imported here has to
  // resolve without the app's bundler, on whatever layout the host flattens
  // to. Taking the client as a parameter removes that question entirely.
  kvClient: KvClient;
  prefix?: string;
  refreshThrottleMs?: number;
  maxEntries?: number;
  maxBytes?: number;
  maxTags?: number;
  logger?: Logger;
}

const DEFAULT_MAX_ENTRIES = 5000;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_TAGS = 10_000;
const DEFAULT_REFRESH_THROTTLE_MS = 1000;
const BUMP_TRIM_AGE_MS = TAG_TTL_HARD_SECONDS * 1000;
const JITTER_MAX_MS = 200;

async function bufferStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const response = new Response(stream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function createStreamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function createEmptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

export function createDistributedCacheHandler({
  appName,
  kvClient,
  prefix = CACHE_KEY_PREFIX,
  refreshThrottleMs = DEFAULT_REFRESH_THROTTLE_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxBytes = DEFAULT_MAX_BYTES,
  maxTags = DEFAULT_MAX_TAGS,
  logger = console,
}: CreateDistributedCacheHandlerOptions): CacheHandler {
  const redisEnabled = hasRedisEnv();
  const env = getCacheNamespace(redisEnabled);

  const tagKey = (tag: string) => getTagKey(prefix, env, appName, tag);
  const bumpKey = getBumpKey(prefix, env, appName);

  const localCache = new Map<string, StoredEntry>();
  const staleTimestamps = new Map<string, number>();
  const expiredTimestamps = new Map<string, number>();
  const pendingSets = new Map<string, Promise<void>>();
  let totalBytes = 0;
  let lastSyncMs = 0;
  let inFlightRefresh: Promise<void> | undefined;

  function evictIfNeeded() {
    while (localCache.size > maxEntries || totalBytes > maxBytes) {
      const oldestKey = localCache.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = localCache.get(oldestKey);
      if (oldest && oldest.bytes) {
        totalBytes -= oldest.bytes.byteLength;
      }
      localCache.delete(oldestKey);
    }
  }

  function getMaxStaleTimestamp(tags: string[]): number {
    return tags.reduce(
      (max, tag) => Math.max(max, staleTimestamps.get(tag) ?? 0),
      0,
    );
  }

  function getMaxExpiredTimestamp(tags: string[]): number {
    return tags.reduce(
      (max, tag) => Math.max(max, expiredTimestamps.get(tag) ?? 0),
      0,
    );
  }

  function applyTagState(tag: string, staleAt: number, expiredAt: number) {
    const existingStale = staleTimestamps.get(tag) ?? 0;

    if (staleAt >= existingStale) {
      // Map iteration follows insertion order; delete+set re-positions the
      // tag to the tail so enforceMaxTags() drops the least-recently-bumped
      // tags first when the cap is exceeded.
      staleTimestamps.delete(tag);
      expiredTimestamps.delete(tag);
      staleTimestamps.set(tag, staleAt);
      expiredTimestamps.set(tag, expiredAt);
    }
  }

  function evictEntriesForDroppedTags(droppedTags: Set<string>) {
    // Dropping a tag from staleTimestamps/expiredTimestamps would let any
    // localCache entry that depended on it become readable as fresh again,
    // since isEntryStale/isEntryExpired would no longer see the bump.
    // Explicit entry.tags are inspectable, but softTags are passed at read
    // time and are not recorded on the stored entry, so we cannot identify
    // which entries depended on a dropped tag only through softTags.
    // Conservative correctness: clear all stored entries whenever any tag
    // state is dropped, mirroring what a process restart would do. The
    // overflow paths that trigger this fire infrequently (only once cap is
    // exceeded), so the cold-cache cost is bounded.
    if (droppedTags.size === 0) return;
    localCache.clear();
    totalBytes = 0;
  }

  function enforceMaxTags() {
    if (staleTimestamps.size <= maxTags) return;
    const overflow = staleTimestamps.size - maxTags;
    const dropped = new Set<string>();
    const iter = staleTimestamps.keys();
    for (let i = 0; i < overflow; i++) {
      const next = iter.next();
      if (next.done) break;
      dropped.add(next.value);
    }
    for (const tag of dropped) {
      staleTimestamps.delete(tag);
      expiredTimestamps.delete(tag);
    }
    evictEntriesForDroppedTags(dropped);
  }

  function pruneStaleTagState(cutoff: number) {
    const dropped = new Set<string>();
    for (const [tag, staleAt] of staleTimestamps) {
      if (staleAt < cutoff) dropped.add(tag);
    }
    for (const tag of dropped) {
      staleTimestamps.delete(tag);
      expiredTimestamps.delete(tag);
    }
    evictEntriesForDroppedTags(dropped);
  }

  function isEntryExpired(entry: CacheEntry, softTags: string[]): boolean {
    const now = Date.now();
    const maxAgeMs = (entry.expire || entry.revalidate || 0) * 1000;
    if (maxAgeMs > 0 && now - entry.timestamp > maxAgeMs) {
      return true;
    }

    const explicitExpired = getMaxExpiredTimestamp(entry.tags);
    const softExpired = getMaxExpiredTimestamp(softTags);
    const maxExpired = Math.max(explicitExpired, softExpired);

    // Matches Next.js areTagsExpired: an entry is expired only when the
    // expire timestamp is in the past AND the entry was created before
    // it. Without the `<= now` guard, a future-dated expiry from
    // revalidateTag(_, "max") would immediately invalidate the entry
    // instead of serving it stale-while-revalidate until the deadline.
    return maxExpired > 0 && maxExpired <= now && maxExpired > entry.timestamp;
  }

  function isEntryStale(entry: CacheEntry, softTags: string[]): boolean {
    const explicitStale = getMaxStaleTimestamp(entry.tags);
    const softStale = getMaxStaleTimestamp(softTags);
    const maxStale = Math.max(explicitStale, softStale);

    return maxStale > entry.timestamp;
  }

  async function refreshTags(force = false): Promise<void> {
    const now = Date.now();

    if (!force && lastSyncMs > 0) {
      const jitter =
        Math.floor(Math.random() * (JITTER_MAX_MS * 2 + 1)) - JITTER_MAX_MS;
      if (now - lastSyncMs < refreshThrottleMs + jitter) {
        return;
      }
    }

    if (inFlightRefresh) {
      return inFlightRefresh;
    }

    inFlightRefresh = (async () => {
      try {
        const minScore = lastSyncMs > 0 ? lastSyncMs : 0;
        const raw = (await kvClient.zrange(bumpKey, minScore, "+inf", {
          byScore: true,
          withScores: true,
        })) as unknown[];

        const changedTags: string[] = [];
        for (let i = 0; i < raw.length; i += 2) {
          const tag = raw[i];
          if (typeof tag === "string") {
            changedTags.push(tag);
          }
        }

        if (changedTags.length > 0) {
          // Fetch the (stale, expired) tuple for each changed tag so the
          // distinction is preserved across deployments — without this,
          // revalidateTag(_, "max") from a peer collapses into hard
          // invalidation on the receiving side.
          const dataKeys = changedTags.map(tagKey);
          const values = (await kvClient.mget(...dataKeys)) as (
            | string
            | null
          )[];

          for (let i = 0; i < changedTags.length; i++) {
            const tag = changedTags[i];
            const tuple = values[i];
            if (!tag || tuple === null || tuple === undefined) continue;
            const [staleStr, expiredStr] = String(tuple).split(",");
            const stale = Number(staleStr);
            const expired = Number(expiredStr);
            if (Number.isFinite(stale) && Number.isFinite(expired)) {
              applyTagState(tag, stale, expired);
            }
          }
          enforceMaxTags();
        }

        lastSyncMs = now;

        // Opportunistic trim of old bump entries (0.1% chance per call).
        // Same probability gates an in-memory sweep of stale tag state so
        // long-lived processes do not retain bumps past their hard TTL.
        if (Math.random() < 0.001) {
          const trimBefore = now - BUMP_TRIM_AGE_MS;
          await kvClient.zremrangebyscore(bumpKey, 0, trimBefore);
          pruneStaleTagState(trimBefore);
        }
      } catch (error) {
        logger.error({ event: "cache.refreshTags.failed", error });
      } finally {
        inFlightRefresh = undefined;
      }
    })();

    return inFlightRefresh;
  }

  return {
    async get(
      cacheKey: string,
      softTags: string[],
    ): Promise<CacheEntry | undefined> {
      const pendingSet = pendingSets.get(cacheKey);
      if (pendingSet) {
        await pendingSet;
      }

      try {
        if (lastSyncMs === 0 && redisEnabled) {
          await refreshTags(true);
        }

        const stored = localCache.get(cacheKey);
        if (!stored) {
          return undefined;
        }

        const { entry, bytes } = stored;

        if (isEntryExpired(entry, softTags)) {
          return undefined;
        }

        let revalidate = entry.revalidate;
        if (isEntryStale(entry, softTags)) {
          revalidate = -1;
        }

        // Move to most-recent position in LRU
        localCache.delete(cacheKey);
        localCache.set(cacheKey, stored);

        // Return a fresh stream reconstructed from stored bytes
        const value =
          bytes !== null ? createStreamFromBytes(bytes) : createEmptyStream();
        return { ...entry, revalidate, value };
      } catch {
        return undefined;
      }
    },

    async set(
      cacheKey: string,
      pendingEntry: Promise<CacheEntry>,
    ): Promise<void> {
      let resolvePending: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePending = resolve;
      });
      pendingSets.set(cacheKey, pendingPromise);

      try {
        const entry = await pendingEntry;

        let byteArray: Uint8Array | null = null;
        if (entry.value) {
          byteArray = await bufferStream(entry.value);
        }

        if (localCache.has(cacheKey)) {
          const existing = localCache.get(cacheKey);
          if (existing && existing.bytes) {
            totalBytes -= existing.bytes.byteLength;
          }
        }

        // Store entry without the original stream so we never try to re-read it.
        // The stream is always reconstructed from bytes on get().
        const storedEntry: CacheEntry = {
          ...entry,
          value: createEmptyStream(),
        };
        localCache.set(cacheKey, { entry: storedEntry, bytes: byteArray });
        if (byteArray) {
          totalBytes += byteArray.byteLength;
        }

        evictIfNeeded();
      } catch (error) {
        logger.error({ event: "cache.set.bufferFailed", cacheKey, error });
      } finally {
        resolvePending();
        pendingSets.delete(cacheKey);
      }
    },

    async updateTags(
      tags: string[],
      durations?: { expire?: number },
    ): Promise<void> {
      const now = Date.now();
      const staleAt = now;
      // No `durations` means hard invalidation (updateTag, or
      // revalidateTag without a profile): expire immediately. With a
      // profile, expire after `expire` seconds — matches Next.js's
      // default handler in next/dist/server/lib/cache-handlers/default.js.
      const expiredAt =
        durations?.expire !== undefined ? now + durations.expire * 1000 : now;

      // Update local stale/expired timestamps immediately so same-process
      // mutations see fresh state without waiting for refreshTags.
      for (const tag of tags) {
        applyTagState(tag, staleAt, expiredAt);
      }
      enforceMaxTags();

      if (!redisEnabled) {
        return;
      }

      // Long TTL for hard invalidations so peers that have been offline
      // for a while still observe the bump on next refresh; shorter TTL
      // for SWR-style bumps where the entry self-expires anyway.
      const ttl =
        durations?.expire === undefined || durations.expire === 0
          ? TAG_TTL_HARD_SECONDS
          : Math.max(TAG_TTL_SOFT_SECONDS, Math.ceil(durations.expire));
      const encoded = `${staleAt},${expiredAt}`;

      try {
        const pipe = kvClient.pipeline();

        for (const tag of tags) {
          // ZSET acts as the delta index for refreshTags; per-tag SET
          // carries the (stale, expired) tuple so peers receive both
          // semantics, not just a single timestamp.
          pipe.zadd(bumpKey, { score: now, member: tag });
          pipe.set(tagKey(tag), encoded, { ex: ttl });
        }

        await pipe.exec();
      } catch (error) {
        logger.error({ event: "cache.updateTags.failed", tags, error });
      }
    },

    async refreshTags(): Promise<void> {
      if (!redisEnabled) {
        return;
      }
      return refreshTags(false);
    },

    async getExpiration(tags: string[]): Promise<number> {
      return getMaxExpiredTimestamp(tags);
    },
  };
}
