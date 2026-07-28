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

interface PublishCacheInvalidationOptions {
  kvClient: KvClient;
  targetAppName: string;
  tags: string[];
  mode?: "expire" | "swr";
}

/**
 * Publish cache invalidation bumps directly to Redis so that peer
 * deployments using the distributed cache handler (with the matching
 * appName) observe the tag changes on their next refreshTags poll.
 *
 * Invalidates only the function-level cache memory. Vercel's edge CDN
 * continues serving cached HTML for up to the cacheLife().revalidate
 * window (1 hour for a long-lived content profile) before re-checking with the
 * function — at which point the function sees the bump and rebuilds.
 * Accepted as a deliberate trade-off; webhook-based edge purges were
 * considered and rejected for the ingress-surface and coupling cost.
 *
 * This is intended for writers (for example CMS collection hooks) that need
 * to invalidate readers in a different app or deployment.
 *
 * @param mode - "expire" hard-invalidates immediately; "swr" marks stale
 * immediately and sets a far-future expiry floor (30 days). SWR mode does
 * not try to match per-tag cacheLife() profiles; it only guarantees the
 * entry will not be treated as hard-expired before that floor.
 */
export async function publishCacheInvalidation({
  kvClient,
  targetAppName,
  tags,
  mode = "expire",
}: PublishCacheInvalidationOptions): Promise<void> {
  if (!hasRedisEnv()) {
    return;
  }

  const env = getCacheNamespace(true);
  const prefix = CACHE_KEY_PREFIX;
  const now = Date.now();

  const staleAt = now;

  // expire = hard invalidation; swr = stale immediately, expire later
  const expiredAt = mode === "swr" ? now + TAG_TTL_SOFT_SECONDS * 1000 : now;

  const ttl = mode === "swr" ? TAG_TTL_SOFT_SECONDS : TAG_TTL_HARD_SECONDS;

  const encoded = `${staleAt},${expiredAt}`;
  const bumpKey = getBumpKey(prefix, env, targetAppName);

  const pipe = kvClient.pipeline();

  for (const tag of tags) {
    const tagKey = getTagKey(prefix, env, targetAppName, tag);
    pipe.zadd(bumpKey, { score: now, member: tag });
    pipe.set(tagKey, encoded, { ex: ttl });
  }

  await pipe.exec();
}
