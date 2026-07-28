import type { TxSyncVocabulary } from "./vocabulary";

export type TxSyncPhase = "pending" | "reconciling" | "warning";
export type TxSyncReconciliationMode = "backend-sync" | "invalidate-only";
export type TxSyncQueryKey = string | string[] | readonly unknown[];

export interface PendingTxScopeItem {
  entityType: string;
  entityId: string;
  conflictKey: string;
  actionKey: string;
  variant?: string;
}

export type NonEmptyPendingTxScopeItems = readonly [
  PendingTxScopeItem,
  ...PendingTxScopeItem[],
];

export interface TxSyncEntry {
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

    const normalizedItems: PendingTxScopeItem[] = [];
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
        ...(typeof it.variant === "string" ? { variant: it.variant } : {}),
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
      pendingItems: normalizedItems as unknown as NonEmptyPendingTxScopeItems,
      ...(typeof candidate.successMessage === "string"
        ? { successMessage: candidate.successMessage }
        : {}),
      ...(Array.isArray(candidate.queryKeysToInvalidate)
        ? { queryKeysToInvalidate: candidate.queryKeysToInvalidate as TxSyncQueryKey[] }
        : {}),
      ...(typeof candidate.syncTxBeforeInvalidate === "boolean"
        ? { syncTxBeforeInvalidate: candidate.syncTxBeforeInvalidate }
        : {}),
      ...(typeof candidate.retryCount === "number"
        ? { retryCount: candidate.retryCount }
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
      const parsed = normalizeEntry(JSON.parse(raw));
      if (!parsed) {
        window.localStorage.removeItem(entryKey(txHash));
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const readStore = (): TxSyncStore => {
    if (!hasStorage()) return {};
    const store: TxSyncStore = {};
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX)) continue;
        const txHash = key.slice(STORAGE_PREFIX.length);
        const entry = readEntry(txHash);
        if (entry) store[txHash] = entry;
      }
    } catch {
      return store;
    }
    return store;
  };

  const persistEntry = (entry: TxSyncEntry): boolean => {
    if (!hasStorage()) return false;
    try {
      window.localStorage.setItem(entryKey(entry.hash), JSON.stringify(entry));
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

  const saveEntry = (
    entry: Omit<TxSyncEntry, "version">,
  ): boolean => {
    const persisted = persistEntry({ ...entry, version: ENTRY_VERSION });
    emitChange();
    return persisted;
  };

  /** Re-reads then patches only this hash, so concurrent tabs cannot clobber. */
  const patchEntry = (
    txHash: string,
    patch: Partial<Omit<TxSyncEntry, "version" | "hash">>,
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
