"use client";

import {
  Fragment,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTransactionReceipt } from "wagmi";
import { truncateString } from "@mydaogs/core";
import {
  reconcileConfirmedTransaction,
  selectDueEntries,
  selectWatchableEntries,
} from "@mydaogs/web3-tx";
import type {
  TxCrossTabOwnership,
  TxSyncEntry,
  TxSyncStorage,
  TxSyncStore,
} from "@mydaogs/web3-tx";
import type { TxMessages, TxToastAdapter } from "@mydaogs/web3-tx";

export interface CreatePendingTxWatcherDeps {
  storage: TxSyncStorage;
  toast: TxToastAdapter;
  messages: TxMessages;
  /** Explorer URL for the active chain, or null when it has none. */
  getExplorerTxUrl: (txHash: string) => string | null;
  /** Backend replay used when an entry has `syncTxBeforeInvalidate`. */
  syncTxHash?: (txHash: `0x${string}`) => Promise<void>;
  /** Runs when a 401 pauses reconciliation. See `createUseAppWriteContract`. */
  onAuthPaused: () => void | Promise<void>;
}

export interface PendingTxWatcherProps {
  /**
   * The connected address, or `null` when disconnected.
   *
   * Entries recorded without an account are always admitted; a disconnected
   * visitor sees only those, so another wallet's pending state is never
   * resumed on a shared browser.
   */
  account?: `0x${string}` | null;
  /**
   * Gate for resuming records at all. Defaults to `true`.
   *
   * Supply the host's "session is authoritative" signal. Persisted records must
   * stay intact while auth is unresolved rather than being resumed against an
   * identity that has not settled — a sign-in remounts this worker and picks up
   * whatever is still eligible.
   */
  isEnabled?: boolean;
}

const EMPTY_STORE: TxSyncStore = {};
const getServerSnapshot = (): TxSyncStore => EMPTY_STORE;

/**
 * Builds the background worker that resumes transactions no live hook owns.
 *
 * A write hook holds its transaction while its surface is mounted. When that
 * surface navigates away — or the tab was closed and reopened — the durable
 * record is all that is left, and this worker is what carries it to
 * settlement. Without it a confirmed transaction silently never invalidates
 * the reads it was meant to refresh.
 *
 * Records are claimed through the same per-hash Web Lock the write hook uses,
 * so exactly one tab reconciles a given transaction.
 */
export function createPendingTxWatcher(deps: CreatePendingTxWatcherDeps) {
  const { storage, toast, messages, getExplorerTxUrl, syncTxHash, onAuthPaused } =
    deps;

  /**
   * Guards against a remount duplicating a reconciliation that is already in
   * flight. Scoped to this watcher rather than module-global, so two storages
   * on one origin cannot collide.
   */
  const activeReconciliations = new Set<string>();

  const buildExplorerAction = (txHash: string) => {
    const url = getExplorerTxUrl(txHash);
    return url ? { label: messages.viewOnExplorer, url } : undefined;
  };

  const PendingTxRecordWatcher = ({ entry }: { entry: TxSyncEntry }) => {
    const hash = entry.hash;
    const queryClient = useQueryClient();
    const handledRef = useRef(false);
    const toastShownRef = useRef(false);
    const mountedRef = useRef(true);
    const isReconcilingRef = useRef(false);
    const hasDurableEntryRef = useRef(false);
    const ownershipRef = useRef<TxCrossTabOwnership | null>(null);
    const [ownership, setOwnership] = useState<TxCrossTabOwnership | null>(null);

    const hasWork =
      Boolean(entry.syncTxBeforeInvalidate) ||
      Boolean(entry.queryKeysToInvalidate.length);

    const { data: receipt, error: receiptError } = useTransactionReceipt({
      hash,
      query: {
        retry: 20,
        retryDelay: (attemptIndex: number) =>
          Math.min(1000 * 2 ** attemptIndex, 10000),
        staleTime: 0,
        gcTime: 0,
        // Polling starts only once the lock is held, so two tabs never run the
        // same reconciliation lifecycle concurrently.
        enabled: Boolean(ownership),
      },
    });

    useEffect(() => {
      mountedRef.current = true;
      const abortController = new AbortController();
      let disposed = false;

      void storage
        .acquireCrossTabOwnership(hash, abortController.signal)
        .then((nextOwnership) => {
          // Re-check the record after the wait: another tab may have settled it
          // while this one sat in the lock queue, and resuming a settled
          // transaction would re-run its invalidation against nothing.
          if (disposed || !nextOwnership || !storage.getSnapshot()[hash]) {
            nextOwnership?.release();
            return;
          }

          hasDurableEntryRef.current = storage.hasEntry(hash);
          ownershipRef.current = nextOwnership;
          setOwnership(nextOwnership);
        });

      return () => {
        mountedRef.current = false;
        disposed = true;
        abortController.abort();
        toast.dismiss(hash);
        // Durable settlement must be allowed to finish after unmount; releasing
        // mid-reconciliation would hand the lock to another tab midway.
        if (!isReconcilingRef.current) {
          ownershipRef.current?.release();
          ownershipRef.current = null;
        }
      };
    }, [hash]);

    useEffect(() => {
      if (!ownership || toastShownRef.current) return;
      toastShownRef.current = true;

      // A record already in `reconciling` was left there by a previous owner,
      // so the toast resumes at that stage rather than restarting at pending.
      // A retried record shows nothing new: its toast is already on screen.
      if (entry.phase === "reconciling" && entry.retryCount === 0) {
        toast.show({
          txHash: hash,
          message: messages.confirmedUpdating,
          action: buildExplorerAction(hash),
        });
      } else if (entry.phase !== "reconciling") {
        toast.show({
          txHash: hash,
          message: messages.pending(truncateString({ value: hash })),
          action: buildExplorerAction(hash),
        });
      }
    }, [entry.phase, entry.retryCount, hash, ownership]);

    useEffect(() => {
      if (!ownership || handledRef.current) return;

      if (receiptError) {
        handledRef.current = true;
        storage.deleteEntry(hash);
        toast.dismiss(hash);
        ownership.release();
        ownershipRef.current = null;
        toast.error(messages.executionError);
        return;
      }

      if (receipt?.status === "reverted") {
        handledRef.current = true;
        storage.deleteEntry(hash);
        toast.dismiss(hash);
        ownership.release();
        ownershipRef.current = null;
        toast.error(messages.reverted);
        return;
      }

      if (receipt?.status !== "success") return;
      if (activeReconciliations.has(hash)) return;

      handledRef.current = true;
      activeReconciliations.add(hash);
      isReconcilingRef.current = true;

      void (async () => {
        try {
          if (hasWork && entry.phase !== "reconciling") {
            storage.patchEntry(hash, { phase: "reconciling" });
            toast.show({
              txHash: hash,
              message: messages.confirmedUpdating,
              action: buildExplorerAction(hash),
            });
          }

          const { invalidationFailed, retainPendingRecord, recoveryAction } =
            await reconcileConfirmedTransaction({
              txHash: hash,
              queryClient,
              queryKeysToInvalidate: entry.queryKeysToInvalidate,
              syncTxBeforeInvalidate: entry.syncTxBeforeInvalidate,
              syncTxHash,
            });

          // Another tab took the lock, or settled the record while this ran.
          if (!ownership.isCurrent() || !storage.getSnapshot()[hash]) return;

          const shouldRetain = retainPendingRecord && hasDurableEntryRef.current;
          if (shouldRetain) {
            storage.scheduleRetry(hash, recoveryAction);
          } else {
            storage.deleteEntry(hash);
          }

          // Durable settlement above runs regardless; everything below is
          // presentation and belongs to a mounted worker.
          if (!mountedRef.current) return;

          toast.dismiss(hash);
          if (shouldRetain && recoveryAction === "pause-auth") {
            void onAuthPaused();
          }

          // Warn once. A retried record has already shown its warning, and
          // repeating it on every attempt turns one stale read into a stream of
          // identical errors.
          if (invalidationFailed) {
            if (entry.retryCount === 0) toast.error(messages.refreshWarning);
          } else {
            toast.success(entry.successMessage ?? messages.success);
          }
        } finally {
          isReconcilingRef.current = false;
          ownership.release();
          ownershipRef.current = null;
          activeReconciliations.delete(hash);
        }
      })();
    }, [
      entry.phase,
      entry.queryKeysToInvalidate,
      entry.successMessage,
      entry.syncTxBeforeInvalidate,
      entry.retryCount,
      hash,
      hasWork,
      ownership,
      queryClient,
      receipt,
      receiptError,
    ]);

    return null;
  };

  return function PendingTxWatcher({
    account,
    isEnabled = true,
  }: PendingTxWatcherProps): ReactElement | null {
    const store = useSyncExternalStore<TxSyncStore>(
      storage.subscribe,
      storage.getSnapshot,
      getServerSnapshot,
    );
    const [retryTick, setRetryTick] = useState(0);

    const visible = useMemo(
      () =>
        selectWatchableEntries({
          store,
          account,
          isLiveOwner: storage.isLiveOwner,
        }),
      [store, account],
    );

    // Wake exactly once, at the soonest scheduled retry. A poll would either
    // burn renders or miss the deadline.
    useEffect(() => {
      const now = Date.now();
      const nextAt = visible
        .map((entry) => entry.nextRetryAt)
        .filter(
          (value): value is number => typeof value === "number" && value > now,
        )
        .sort((left, right) => left - right)[0];

      if (!nextAt) return;

      const timeoutId = setTimeout(
        () => setRetryTick((tick) => tick + 1),
        Math.max(nextAt - now, 0),
      );
      return () => clearTimeout(timeoutId);
    }, [retryTick, visible]);

    const ready = useMemo(() => {
      void retryTick;
      return selectDueEntries(visible);
    }, [retryTick, visible]);

    if (!isEnabled) return null;

    return createElement(
      Fragment,
      null,
      ...ready.map((entry) =>
        createElement(PendingTxRecordWatcher, { key: entry.hash, entry }),
      ),
    );
  };
}
