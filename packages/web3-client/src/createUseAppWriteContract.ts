"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TransactionReceipt } from "viem";
import { useAccount, useTransactionReceipt, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { truncateString } from "@mydaogs/core";
import { resolveContractErrorMessage } from "@mydaogs/web3";
import { reconcileConfirmedTransaction } from "@mydaogs/web3-tx";
import type { TxSyncStorage, NonEmptyPendingTxScopeItems, TxSyncQueryKey } from "@mydaogs/web3-tx";
import type { TxMessages, TxToastAdapter } from "@mydaogs/web3-tx";

export interface UseAppWriteContractProps {
  onTransactionSubmitted?: (params: { hash: `0x${string}` }) => void;
  /**
   * Fires for a successful onchain receipt **after** the reconciliation
   * attempt. A sync or refetch failure suppresses the success toast but does
   * not turn a confirmed transaction into an error — chain finality is not
   * reversed by a failed refresh.
   */
  onSuccess?: (
    receipt: TransactionReceipt,
    result: {
      invalidationFailed: boolean;
      retainPendingRecord: boolean;
      retryable: boolean;
    },
  ) => void;
  onError?: (error: unknown) => void;
  onRevert?: (receipt: TransactionReceipt) => void;
  queryKeysToInvalidate?: TxSyncQueryKey[];
  /** Domain-specific success message shown instead of the generic string. */
  successMessage?: string;
  /** Replay the tx into the backend before invalidating projected reads. */
  syncTxBeforeInvalidate?: boolean;
  onTxSynced?: () => Promise<void> | void;
  /** Friendly copy per Solidity custom error name. */
  errorNameOverrides?: Record<string, string>;
}

export interface WriteContractOptions {
  pendingItems: NonEmptyPendingTxScopeItems;
  /**
   * Keys only this call site knows about — a per-row entity, a per-item chain
   * read. Merged into the hook-level set for this transaction alone, and
   * persisted, so the durable reconciler still refreshes them after the
   * calling surface unmounts.
   */
  queryKeysToInvalidate?: TxSyncQueryKey[];
}

export interface CreateUseAppWriteContractDeps {
  storage: TxSyncStorage;
  toast: TxToastAdapter;
  /**
   * Resolves the copy, called once per render inside the hook.
   *
   * A hook rather than a static object because every mainstream i18n library
   * resolves strings through one — a static bundle would force the host to
   * either pin a locale at module scope or rebuild the factory per render,
   * and rebuilding it changes the component identity and remounts the tree.
   */
  useMessages: () => TxMessages;
  /** Explorer URL for the active chain, or null when it has none. */
  getExplorerTxUrl: (txHash: string) => string | null;
  /** Backend replay used when `syncTxBeforeInvalidate` is set. */
  syncTxHash?: (txHash: `0x${string}`) => Promise<void>;
  /**
   * Runs when a 401 pauses reconciliation, to refresh session authority before
   * the retry.
   *
   * **Required, and deliberately not optional.** A pause-auth outcome retains
   * the durable record and schedules a retry without consuming an attempt, so
   * nothing surfaces if session authority is never refreshed — the retry simply
   * 401s again until the budget is gone. A project with no session concept
   * passes an explicit no-op, which is a decision rather than an omission.
   */
  onAuthPaused: () => void | Promise<void>;
}

/**
 * Builds the `useAppWriteContract` hook bound to a project's storage, toast,
 * and copy.
 *
 * The lifecycle it owns:
 *
 * 1. submit → queue cross-tab ownership, persist the durable record, publish
 *    the hash. Ownership is queued *before* the record is written so a watcher
 *    woken by the storage event cannot overtake this hook in the lock queue
 * 2. receipt polling → only after ownership is granted, so two tabs never run
 *    the same callback/sync lifecycle concurrently
 * 3. reconciliation → phase flips to `reconciling`, the hash-keyed toast
 *    updates in place, sync and invalidation run
 * 4. settle → durable cleanup runs even if the surface unmounted mid-flight;
 *    callbacks and toasts only fire while still mounted
 *
 * The split in step 4 is the subtle part. Durable settlement must complete
 * after navigation or the record leaks, but callback closures belong to the
 * mounted surface and cannot transfer to a watcher.
 */
export function createUseAppWriteContract(deps: CreateUseAppWriteContractDeps) {
  const { storage, toast, useMessages, getExplorerTxUrl, syncTxHash, onAuthPaused } =
    deps;

  return function useAppWriteContract(props?: UseAppWriteContractProps) {
    const messages = useMessages();
    // Silently falling back to invalidate-only would persist a record claiming
    // `reconciliationMode: "backend-sync"` that no watcher can ever satisfy,
    // and projected reads would stay stale behind indexer latency with no
    // signal. Fail at the call site instead.
    if (props?.syncTxBeforeInvalidate && !syncTxHash) {
      throw new Error(
        "useAppWriteContract: syncTxBeforeInvalidate requires a `syncTxHash` dependency on createUseAppWriteContract",
      );
    }

    const queryClient = useQueryClient();
    const { address } = useAccount();
    const {
      writeContractAsync,
      data: hash,
      error: txError,
      isPending: isTxPending,
      reset: resetWriteContract,
    } = useWriteContract();

    type WriteParams = Parameters<typeof writeContractAsync>[0];

    const buildExplorerAction = useCallback(
      (txHash: `0x${string}`) => {
        const url = getExplorerTxUrl(txHash);
        return url ? { label: messages.viewOnExplorer, url } : undefined;
      },
      [],
    );

    const hasHandledReceiptRef = useRef(false);
    const mountedRef = useRef(true);
    const activeTxHashRef = useRef<`0x${string}` | null>(null);
    const isReconcilingRef = useRef(false);
    const isSubmittingRef = useRef(false);
    const hasDurableEntryRef = useRef(false);
    const contextRef = useRef<UseAppWriteContractProps & {
      account: `0x${string}` | null;
      queryKeysToInvalidate?: TxSyncQueryKey[];
    } | null>(null);
    const ownershipRef = useRef<{ isCurrent: () => boolean; release: () => void } | null>(null);
    const ownershipAbortRef = useRef<AbortController | null>(null);
    const [ownedTxHash, setOwnedTxHash] = useState<`0x${string}` | null>(null);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        // Release ownership on unmount unless reconciliation is mid-flight —
        // that must finish and settle the durable record.
        if (activeTxHashRef.current && !isReconcilingRef.current) {
          ownershipAbortRef.current?.abort();
          ownershipAbortRef.current = null;
          storage.releaseLiveOwner(activeTxHashRef.current);
          ownershipRef.current?.release();
          ownershipRef.current = null;
        }
        isSubmittingRef.current = false;
      };
    }, []);

    const { error: receiptError, data: receipt } = useTransactionReceipt({
      hash,
      query: {
        retry: 20,
        retryDelay: (attemptIndex: number) =>
          Math.min(1000 * 2 ** attemptIndex, 10_000),
        staleTime: 0,
        gcTime: 0,
        enabled: !!hash && ownedTxHash === hash,
      },
    });

    const cleanupTerminal = useCallback((txHash: `0x${string}`) => {
      storage.releaseLiveOwner(txHash);
      ownershipRef.current?.release();
      ownershipRef.current = null;
      resetWriteContract();
      activeTxHashRef.current = null;
      contextRef.current = null;
      hasDurableEntryRef.current = false;
      isSubmittingRef.current = false;
      if (mountedRef.current) setOwnedTxHash(null);
    }, [resetWriteContract]);

    // Receipt errors. Submission errors are caught by the wrapper directly.
    useEffect(() => {
      if (!hash || !receiptError) return;
      const context = contextRef.current;
      if (!context) return;

      storage.deleteEntry(hash);
      toast.dismiss(hash);
      context.onError?.(receiptError);
      toast.error(
        resolveContractErrorMessage({
          error: receiptError,
          fallback: messages.executionError,
          errorNameOverrides: context.errorNameOverrides,
        }),
      );
      cleanupTerminal(hash);
    }, [receiptError, hash, cleanupTerminal]);

    useEffect(() => {
      if (hasHandledReceiptRef.current || !hash) return;
      const context = contextRef.current;
      if (!context) return;

      if (receipt?.status === "reverted") {
        hasHandledReceiptRef.current = true;
        storage.deleteEntry(hash);
        toast.dismiss(hash);
        toast.error(messages.reverted);
        context.onRevert?.(receipt);
        cleanupTerminal(hash);
        return;
      }

      if (receipt?.status !== "success") return;
      hasHandledReceiptRef.current = true;

      const handleSuccess = async () => {
        const hasWork =
          Boolean(context.syncTxBeforeInvalidate) ||
          Boolean(context.queryKeysToInvalidate?.length);
        isReconcilingRef.current = true;

        try {
          // Enter the reconciliation phase only when there is real work.
          // Reusing the hash-derived toast id updates it in place.
          if (hasWork) {
            storage.patchEntry(hash, { phase: "reconciling" });
            toast.show({
              txHash: hash,
              message: messages.confirmedUpdating,
              action: buildExplorerAction(hash),
            });
          } else {
            toast.dismiss(hash);
          }

          const { invalidationFailed, retainPendingRecord, recoveryAction } =
            await reconcileConfirmedTransaction({
              txHash: hash,
              queryClient,
              queryKeysToInvalidate: context.queryKeysToInvalidate,
              syncTxBeforeInvalidate: context.syncTxBeforeInvalidate,
              syncTxHash,
              onSynced: context.onTxSynced,
            });

          // Another tab took over, or the record was settled elsewhere.
          if (
            !ownershipRef.current?.isCurrent() ||
            (hasDurableEntryRef.current && !storage.hasEntry(hash))
          ) {
            return;
          }

          const shouldRetain = retainPendingRecord && hasDurableEntryRef.current;

          // This toast is global and persistent: dismiss it even if the
          // initiating surface navigated away mid-reconciliation.
          if (hasWork) toast.dismiss(hash);

          if (!shouldRetain) {
            storage.deleteEntry(hash);
          } else {
            if (recoveryAction === "pause-auth") {
              void onAuthPaused();
            }
            storage.scheduleRetry(hash, recoveryAction);
          }

          if (mountedRef.current) {
            if (invalidationFailed) toast.error(messages.refreshWarning);
            try {
              context.onSuccess?.(receipt, {
                invalidationFailed,
                retainPendingRecord: shouldRetain,
                retryable: shouldRetain && recoveryAction === "retry",
              });
              if (!invalidationFailed) {
                toast.success(context.successMessage ?? messages.success);
              }
            } catch (error) {
              console.error("Error in success handler:", error);
              toast.error(messages.unexpectedError);
            }
          }
        } finally {
          isReconcilingRef.current = false;
          cleanupTerminal(hash);
        }
      };

      void handleSuccess();
    }, [receipt, hash, queryClient, buildExplorerAction, cleanupTerminal]);

    const writeContract = async (
      params: WriteParams,
      options: WriteContractOptions,
    ): Promise<`0x${string}` | null> => {
      if (isSubmittingRef.current) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Ignoring concurrent contract write submission");
        }
        return null;
      }

      isSubmittingRef.current = true;
      const context = {
        ...props,
        account: address ?? null,
        queryKeysToInvalidate:
          props?.queryKeysToInvalidate || options.queryKeysToInvalidate
            ? [
                ...(props?.queryKeysToInvalidate ?? []),
                ...(options.queryKeysToInvalidate ?? []),
              ]
            : undefined,
      };
      contextRef.current = context;
      hasDurableEntryRef.current = false;
      activeTxHashRef.current = null;

      try {
        const submittedHash = await writeContractAsync(params);
        const message = messages.pending(truncateString({ value: submittedHash }));

        const abortController = new AbortController();
        ownershipAbortRef.current = abortController;
        // Queue for the lock BEFORE persisting, so a watcher notified by the
        // storage event cannot overtake this hook in the per-hash queue.
        const ownershipPromise = storage.acquireCrossTabOwnership(
          submittedHash,
          abortController.signal,
        );

        activeTxHashRef.current = submittedHash;
        hasDurableEntryRef.current = storage.saveEntry({
          hash: submittedHash,
          timestamp: Date.now(),
          phase: "pending",
          account: context.account,
          reconciliationMode: context.syncTxBeforeInvalidate
            ? "backend-sync"
            : "invalidate-only",
          pendingItems: options.pendingItems,
          ...(context.successMessage ? { successMessage: context.successMessage } : {}),
          ...(context.queryKeysToInvalidate
            ? { queryKeysToInvalidate: context.queryKeysToInvalidate }
            : {}),
          ...(context.syncTxBeforeInvalidate
            ? { syncTxBeforeInvalidate: true }
            : {}),
        });

        if (mountedRef.current) {
          try {
            context.onTransactionSubmitted?.({ hash: submittedHash });
          } catch (callbackError) {
            console.error("onTransactionSubmitted callback failed:", callbackError);
          }
        }

        const ownership = await ownershipPromise;
        if (!mountedRef.current || !ownership?.isCurrent()) {
          // Cannot safely continue as live owner. A watcher can reconcile an
          // available store entry, but callback closures cannot transfer.
          ownership?.release();
          cleanupTerminal(submittedHash);
          return submittedHash;
        }

        ownershipRef.current = ownership;
        setOwnedTxHash(submittedHash);
        storage.markLiveOwner(submittedHash);
        toast.show({
          txHash: submittedHash,
          message,
          action: buildExplorerAction(submittedHash),
        });

        hasHandledReceiptRef.current = false;
        return submittedHash;
      } catch (error) {
        context.onError?.(error);
        toast.error(
          resolveContractErrorMessage({
            error,
            fallback: messages.submissionError,
            errorNameOverrides: context.errorNameOverrides,
          }),
        );
        ownershipRef.current?.release();
        ownershipRef.current = null;
        if (mountedRef.current) setOwnedTxHash(null);
        resetWriteContract();
        contextRef.current = null;
        hasDurableEntryRef.current = false;
        isSubmittingRef.current = false;
        return null;
      }
    };

    return {
      writeContract,
      // `hash` stays set from submission until the terminal reset, so
      // isProcessing is continuously true through receipt + reconciliation
      // with no flicker in between.
      isProcessing: isTxPending || Boolean(hash),
      hash,
      receipt,
      isError: !!receiptError || !!txError,
    };
  };
}
