import { bigIntParse, bigIntStringify } from "@mydaogs/core";
import type { TxSyncVocabulary } from "./vocabulary";

export type TxSyncPhase = "pending" | "reconciling" | "warning";
export type TxSyncReconciliationMode = "backend-sync" | "invalidate-only";
export type TxSyncQueryKey = string | string[] | readonly unknown[];

/**
 * Conflict and visibility policy for an item. **Normative** — the selector
 * interprets it.
 *
 * - `replace` — a newer write supersedes an older one on the same
 *   entity-and-conflict key. Only the newest stays visible, and only it blocks.
 *   Editing the same terms twice is one pending state, not two.
 * - `additive` — independent operations that happen to share an entity. Each
 *   stays visible and each blocks on its own. Granting two roles to one account
 *   is two facts; collapsing them would hide the first.
 *
 * Resolving precedence by `timestamp` alone cannot express the difference —
 * it always supersedes, so an `additive` set silently renders as one entry.
 * Absent means `replace`: the conservative reading of a write that declared no
 * policy, and the pre-0.3 behaviour.
 */
export type TxSyncVariant = "replace" | "additive";

export interface PendingTxScopeItem {
  entityType: string;
  entityId: string;
  /** Disables every control sharing this key on this entity. */
  conflictKey: string;
  /** Identifies the originating control, so only it restores its spinner. */
  actionKey: string;
  /** Defaults to `replace` when absent. */
  variant?: TxSyncVariant;
}

/** A hydrated item: `variant` is always resolved. */
export interface ResolvedPendingTxScopeItem extends PendingTxScopeItem {
  variant: TxSyncVariant;
}

export type NonEmptyPendingTxScopeItems = readonly [
  PendingTxScopeItem,
  ...PendingTxScopeItem[],
];

export type NonEmptyResolvedPendingTxScopeItems = readonly [
  ResolvedPendingTxScopeItem,
  ...ResolvedPendingTxScopeItem[],
];

/**
 * The shape a caller supplies to `saveEntry`. Optional fields stay optional
 * here; what hydration returns is the stricter `TxSyncEntry` below.
 */
export interface TxSyncEntryInput {
  version: 1;
  hash: `0x${string}`;
  timestamp: number;
  phase: TxSyncPhase;
  account: `0x${string}` | null;
  reconciliationMode: TxSyncReconciliationMode;
  pendingItems: NonEmptyPendingTxScopeItems;
  successMessage?: string;
  queryKeysToInvalidate?: TxSyncQueryKey[];
  syncTxBeforeInvalidate?: boolean;
  retryCount?: number;
  nextRetryAt?: number;
}

/**
 * A hydrated entry.
 *
 * `queryKeysToInvalidate` and `retryCount` are **required** here even though
 * they are optional on input, because hydration always resolves them. Leaving
 * them optional on the read type is what lets a consumer write
 * `entry.queryKeysToInvalidate.length` or `entry.retryCount === 0` against a
 * value that type-checks and is `undefined` at runtime.
 */
export interface TxSyncEntry extends TxSyncEntryInput {
  pendingItems: NonEmptyResolvedPendingTxScopeItems;
  queryKeysToInvalidate: TxSyncQueryKey[];
  retryCount: number;
}

export type TxSyncStore = Record<string, TxSyncEntry>;

export interface TxCrossTabOwnership {
  isCurrent: () => boolean;
  release: () => void;
}

const STORAGE_PREFIX = "tx_sync:";
const LOCK_PREFIX = "tx-sync-lock:";
const TTL_MS = 7 * 24 * 3600 * 1000;
const ENTRY_VERSION = 1;

const isValidTxHash = (value: string): value is `0x${string}` =>
  /^0x[a-fA-F0-9]{64}$/.test(value);

/**
 * Durable registry for in-flight transactions.
 *
 * Deliberately stores **no render payload**. All UI shows server or chain
 * truth until reconciliation invalidates and refetches it — which sidesteps
 * optimistic-UI reconciliation entirely, because there is never a local value
 * that can disagree with the chain.
 *
 * One localStorage key per hash. Whole-object read-modify-write cannot safely
 * merge simultaneous completions from different tabs; per-hash keys mean each
 * mutation touches only its own record.
 */
export function createTxSyncStorage(params: {
  vocabulary: TxSyncVocabulary;
  /** Namespace for Web Lock names, so two apps on one origin cannot collide. */
  lockNamespace: string;
  maxRetryCount?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
}) {
  const {
    vocabulary,
    lockNamespace,
    maxRetryCount = 5,
    retryDelayMs = 1000,
    maxRetryDelayMs = 60_000,
  } = params;

  const listeners = new Set<() => void>();
  const liveOwners = new Set<string>();
  const fallbackOwners = new Set<string>();
  const fallbackWaiters = new Map<string, Array<() => void>>();
  let snapshot: TxSyncStore = {};
  let snapshotDirty = true;

  const hasStorage = (): boolean => {
    try {
      return typeof window !== "undefined" && !!window.localStorage;
    } catch {
      return false;
    }
  };

  const emitChange = () => {
    snapshotDirty = true;
    for (const listener of listeners) listener();
  };

  const entryKey = (txHash: string) => `${STORAGE_PREFIX}${txHash}`;

  /**
   * Hydration accepts only complete, current-version entries whose entity,
   * action, and conflict identifiers are all recognized. Anything else is
   * deleted rather than repaired — a versioned envelope has exactly one
   * accepted shape, and a reader for an older one is a migration in disguise.
   */
  const normalizeEntry = (raw: unknown): TxSyncEntry | null => {
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Record<string, unknown>;

    if (candidate.version !== ENTRY_VERSION) return null;
    if (typeof candidate.hash !== "string" || !isValidTxHash(candidate.hash)) {
      return null;
    }
    if (typeof candidate.timestamp !== "number") return null;
    if (Date.now() - candidate.timestamp > TTL_MS) return null;

    const phase = candidate.phase;
    if (phase !== "pending" && phase !== "reconciling" && phase !== "warning") {
      return null;
    }

    const mode = candidate.reconciliationMode;
    if (mode !== "backend-sync" && mode !== "invalidate-only") return null;

    const items = candidate.pendingItems;
    if (!Array.isArray(items) || items.length === 0) return null;

    const normalizedItems: ResolvedPendingTxScopeItem[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") return null;
      const it = item as Record<string, unknown>;
      if (
        typeof it.entityType !== "string" ||
        typeof it.entityId !== "string" ||
        typeof it.conflictKey !== "string" ||
        typeof it.actionKey !== "string"
      ) {
        return null;
      }
      if (
        !vocabulary.isEntity(it.entityType) ||
        !vocabulary.isConflict(it.conflictKey) ||
        !vocabulary.isAction(it.actionKey)
      ) {
        return null;
      }
      normalizedItems.push({
        entityType: it.entityType,
        entityId: it.entityId,
        conflictKey: it.conflictKey,
        actionKey: it.actionKey,
        // An unrecognized variant resolves to `replace` rather than rejecting
        // the record: the policy is a rendering hint, and discarding an
        // in-flight transaction over it would be a worse failure than
        // rendering it conservatively.
        variant: it.variant === "additive" ? "additive" : "replace",
      });
    }

    return {
      version: ENTRY_VERSION,
      hash: candidate.hash as `0x${string}`,
      timestamp: candidate.timestamp,
      phase,
      account:
        typeof candidate.account === "string"
          ? (candidate.account as `0x${string}`)
          : null,
      reconciliationMode: mode,
      pendingItems:
        normalizedItems as unknown as NonEmptyResolvedPendingTxScopeItems,
      // Always resolved, never conditionally spread: these two are required on
      // the read type precisely so a consumer cannot get `undefined` from a
      // field the compiler says is present.
      queryKeysToInvalidate: Array.isArray(candidate.queryKeysToInvalidate)
        ? (candidate.queryKeysToInvalidate as TxSyncQueryKey[])
        : [],
      retryCount:
        typeof candidate.retryCount === "number" ? candidate.retryCount : 0,
      ...(typeof candidate.successMessage === "string"
        ? { successMessage: candidate.successMessage }
        : {}),
      ...(typeof candidate.syncTxBeforeInvalidate === "boolean"
        ? { syncTxBeforeInvalidate: candidate.syncTxBeforeInvalidate }
        : {}),
      ...(typeof candidate.nextRetryAt === "number"
        ? { nextRetryAt: candidate.nextRetryAt }
        : {}),
    };
  };

  const readEntry = (txHash: string): TxSyncEntry | null => {
    if (!hasStorage()) return null;
    try {
      const raw = window.localStorage.getItem(entryKey(txHash));
      if (!raw) return null;
      const parsed = normalizeEntry(bigIntParse(raw));
      if (!parsed) {
        window.localStorage.removeItem(entryKey(txHash));
        return null;
      }
      return parsed;
    } catch {
      // Unparseable JSON is also unrecoverable. Purge it, or it is re-read and
      // re-thrown on every single snapshot for the next seven days.
      try {
        window.localStorage.removeItem(entryKey(txHash));
      } catch {
        /* storage unavailable */
      }
      return null;
    }
  };

  /**
   * Materializes the key list BEFORE reading any entry.
   *
   * `readEntry` deletes expired or invalid records, and `Storage.key(i)` is a
   * live index into the store. Deleting mid-iteration shifts every later key
   * down one slot, so `i++` then skips the next record — a single stale entry
   * would make the following pending transaction invisible to the watcher: no
   * reconciliation, no toast, and a record that never settles.
   */
  const getEntryStorageKeys = (): string[] => {
    const keys: string[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
      }
    } catch {
      return keys;
    }
    return keys;
  };

  const readStore = (): TxSyncStore => {
    if (!hasStorage()) return {};
    const store: TxSyncStore = {};
    for (const key of getEntryStorageKeys()) {
      const txHash = key.slice(STORAGE_PREFIX.length);
      const entry = readEntry(txHash);
      if (entry) store[txHash] = entry;
    }
    return store;
  };

  // Accepts the input shape: a patch merged over a hydrated entry can widen
  // `pendingItems` back to items whose `variant` is not yet resolved, and the
  // read path resolves it again on the way out.
  const persistEntry = (entry: TxSyncEntryInput): boolean => {
    if (!hasStorage()) return false;
    try {
      // bigIntStringify, not JSON.stringify: queryKeysToInvalidate may carry
      // bigints, and raw stringify throws on them — the record would silently
      // never persist, disabling retry, cross-tab recovery and reload recovery.
      window.localStorage.setItem(entryKey(entry.hash), bigIntStringify(entry));
      return true;
    } catch {
      return false;
    }
  };

  const deleteEntry = (txHash: string) => {
    if (hasStorage()) {
      try {
        window.localStorage.removeItem(entryKey(txHash));
      } catch {
        /* storage unavailable — nothing durable to remove */
      }
    }
    emitChange();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (!event.key || event.key.startsWith(STORAGE_PREFIX)) emitChange();
    });
  }

  const getSnapshot = (): TxSyncStore => {
    if (snapshotDirty) {
      snapshot = readStore();
      snapshotDirty = false;
    }
    return snapshot;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // ── Cross-tab ownership ────────────────────────────────────────────────
  // Receipt polling and reconciliation must run in exactly one tab. The
  // submitting hook queues for the lock *before* publishing the durable entry,
  // so a watcher woken by the storage event cannot overtake it in the queue.

  const createFallbackOwnership = (txHash: string): TxCrossTabOwnership => {
    let released = false;
    fallbackOwners.add(txHash);
    return {
      isCurrent: () => !released && fallbackOwners.has(txHash),
      release: () => {
        if (released) return;
        released = true;
        fallbackOwners.delete(txHash);
        const queue = fallbackWaiters.get(txHash);
        const next = queue?.shift();
        if (queue && queue.length === 0) fallbackWaiters.delete(txHash);
        next?.();
      },
    };
  };

  /** FIFO fallback for environments without the Web Locks API. */
  const acquireFallbackOwnership = async (
    txHash: string,
    signal?: AbortSignal,
  ): Promise<TxCrossTabOwnership | null> => {
    if (!fallbackOwners.has(txHash)) return createFallbackOwnership(txHash);

    return new Promise<TxCrossTabOwnership | null>((resolve) => {
      const waiter = () => {
        if (signal?.aborted) {
          resolve(null);
          return;
        }
        resolve(createFallbackOwnership(txHash));
      };
      const queue = fallbackWaiters.get(txHash) ?? [];
      queue.push(waiter);
      fallbackWaiters.set(txHash, queue);

      signal?.addEventListener("abort", () => {
        const pending = fallbackWaiters.get(txHash);
        if (!pending) return;
        const index = pending.indexOf(waiter);
        if (index >= 0) pending.splice(index, 1);
        resolve(null);
      });
    });
  };

  const acquireCrossTabOwnership = async (
    txHash: string,
    signal?: AbortSignal,
  ): Promise<TxCrossTabOwnership | null> => {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks) return acquireFallbackOwnership(txHash, signal);

    return new Promise<TxCrossTabOwnership | null>((resolve) => {
      let released = false;
      let releaseLock: (() => void) | undefined;

      const ownership: TxCrossTabOwnership = {
        isCurrent: () => !released,
        release: () => {
          if (released) return;
          released = true;
          releaseLock?.();
        },
      };

      locks
        .request(
          `${lockNamespace}:${LOCK_PREFIX}${txHash}`,
          { signal },
          () =>
            new Promise<void>((releaseResolve) => {
              releaseLock = releaseResolve;
              resolve(ownership);
            }),
        )
        .catch(() => {
          if (!released) resolve(null);
        });
    });
  };

  // ── Live (same-tab) ownership ──────────────────────────────────────────
  // Distinct from the cross-tab lock: it marks which hook in *this* tab holds
  // the callback closures, so a watcher does not also render a toast for it.

  const markLiveOwner = (txHash: string) => {
    liveOwners.add(txHash);
  };
  const releaseLiveOwner = (txHash: string) => {
    liveOwners.delete(txHash);
  };
  const isLiveOwner = (txHash: string) => liveOwners.has(txHash);

  // ── Mutations ─────────────────────────────────────────────────────────

  const saveEntry = (entry: Omit<TxSyncEntryInput, "version">): boolean => {
    const candidate = { ...entry, version: ENTRY_VERSION } as TxSyncEntry;

    // Validate on write, exactly as the read path does. Persisting an entry the
    // reader will reject creates a record that purges itself on first read; the
    // submitting hook's takeover guard sees the absence and concludes another
    // tab settled it, so the toast never clears and `onSuccess` never fires.
    if (!normalizeEntry(candidate)) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "createTxSyncStorage.saveEntry: entry rejected by its own validator — check that every entityType/actionKey/conflictKey is registered in the vocabulary",
          candidate,
        );
      }
      return false;
    }

    const persisted = persistEntry(candidate);
    emitChange();
    return persisted;
  };

  /** Re-reads then patches only this hash, so concurrent tabs cannot clobber. */
  const patchEntry = (
    txHash: string,
    patch: Partial<Omit<TxSyncEntryInput, "version" | "hash">>,
  ): void => {
    const existing = readEntry(txHash);
    if (!existing) return;
    persistEntry({ ...existing, ...patch });
    emitChange();
  };

  const hasEntry = (txHash: string): boolean => readEntry(txHash) !== null;

  /**
   * Schedules the next retry, or settles the record into a terminal warning.
   *
   * A `pause-auth` outcome does **not** consume a retry: an expired session is
   * not evidence the transaction cannot reconcile, and burning attempts on it
   * would exhaust a recoverable record.
   */
  const scheduleRetry = (
    txHash: string,
    recoveryAction: "pause-auth" | "retry" | "terminal",
  ): void => {
    const existing = readEntry(txHash);
    if (!existing) return;

    if (recoveryAction === "terminal") {
      patchEntry(txHash, { phase: "warning" });
      return;
    }

    if (recoveryAction === "pause-auth") {
      patchEntry(txHash, { phase: "reconciling", nextRetryAt: Date.now() });
      return;
    }

    const retryCount = (existing.retryCount ?? 0) + 1;
    if (retryCount > maxRetryCount) {
      patchEntry(txHash, { phase: "warning" });
      return;
    }

    const delay = Math.min(
      retryDelayMs * 2 ** (retryCount - 1),
      maxRetryDelayMs,
    );
    patchEntry(txHash, {
      phase: "reconciling",
      retryCount,
      nextRetryAt: Date.now() + delay,
    });
  };

  return {
    getSnapshot,
    subscribe,
    readEntry,
    hasEntry,
    saveEntry,
    patchEntry,
    deleteEntry,
    scheduleRetry,
    acquireCrossTabOwnership,
    markLiveOwner,
    releaseLiveOwner,
    isLiveOwner,
  };
}

export type TxSyncStorage = ReturnType<typeof createTxSyncStorage>;
