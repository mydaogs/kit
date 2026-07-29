import type { QueryClient } from "@tanstack/react-query";
import { stableHash } from "@mydaogs/core";
import { AppBusinessError } from "@mydaogs/contract";
import type { TxSyncQueryKey } from "./txSyncStorage";

export type RecoveryAction = "pause-auth" | "retry" | "terminal";

export interface ReconcileResult {
  invalidationFailed: boolean;
  retainPendingRecord: boolean;
  recoveryAction: RecoveryAction;
}

/** Wraps a refetch failure so the caller can tell it apart from a sync failure. */
export class QueryRefetchFailureError extends Error {
  queryKey: TxSyncQueryKey;

  constructor(queryKey: TxSyncQueryKey, cause: unknown) {
    super("Query refetch failed after confirmed transaction");
    this.name = "QueryRefetchFailureError";
    this.queryKey = queryKey;
    this.cause = cause;
  }
}

const toQueryKeyArray = (key: TxSyncQueryKey): readonly unknown[] =>
  Array.isArray(key) ? key : [key];

/**
 * Invalidates the given keys, deduped, refetching only **active** queries.
 *
 * Inactive matches stay stale and refresh on their next mount. Refetching them
 * here would let an unmounted screen's failure turn a confirmed, final onchain
 * transaction into a user-visible warning.
 *
 * `throwOnError` is what makes a refetch that lands in an error state reject:
 * without it, success would be reported over stale UI.
 */
export async function invalidateQueryKeys(params: {
  queryClient: QueryClient;
  queryKeysToInvalidate: readonly TxSyncQueryKey[];
}): Promise<void> {
  const seen = new Set<string>();
  const unique: TxSyncQueryKey[] = [];

  for (const key of params.queryKeysToInvalidate) {
    // `stableHash`, not `JSON.stringify`: wallet-library query keys routinely
    // carry bigints (chain ids, amounts, block numbers), and stringify throws
    // on them — which would fail dedupe before any invalidation ran, turning
    // every confirmed transaction into a false refresh-warning.
    const serialized = stableHash(toQueryKeyArray(key));
    if (seen.has(serialized)) continue;
    seen.add(serialized);
    unique.push(key);
  }

  // `allSettled`, not a sequential loop that throws on the first failure.
  //
  // Every key must be attempted and awaited before anything is re-thrown. A
  // fast-fail closes the reconciliation window while later refetches are still
  // in flight: keys after the failing one are never invalidated at all, so a
  // confirmed transaction leaves part of the UI stale — and the retry that gets
  // scheduled covers the whole record, not the keys that were skipped.
  const results = await Promise.allSettled(
    unique.map((key) =>
      params.queryClient
        .invalidateQueries(
          { queryKey: toQueryKeyArray(key), refetchType: "active" },
          { throwOnError: true },
        )
        .catch((error) => {
          throw new QueryRefetchFailureError(key, error);
        }),
    ),
  );

  const firstRejection = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (firstRejection) throw firstRejection.reason;
}

/**
 * Classifies a backend-sync failure into a retry posture.
 *
 * A 401 pauses without consuming a retry — session authority is refreshed and
 * the record survives for a later sign-in. Server errors, rate limits, and an
 * indexer lease already in progress are transient. Everything else is terminal:
 * retrying a deterministic rejection just burns attempts.
 */
export function getSyncRecoveryAction(error: unknown): RecoveryAction {
  if (!(error instanceof AppBusinessError)) return "retry";
  if (error.statusCode === 401) return "pause-auth";
  if (error.statusCode >= 500) return "retry";
  if (error.statusCode === 429) return "retry";
  return error.code === "SYNC_IN_PROGRESS" || error.code === "TOO_MANY_REQUESTS"
    ? "retry"
    : "terminal";
}

export interface ReconcileParams {
  txHash: `0x${string}`;
  queryClient: QueryClient;
  queryKeysToInvalidate?: readonly TxSyncQueryKey[];
  syncTxBeforeInvalidate?: boolean;
  /**
   * Replays the tx into the backend so projected reads reflect immediately,
   * independent of indexer latency. Should carry its own elapsed-time budget.
   */
  syncTxHash?: (txHash: `0x${string}`) => Promise<void>;
  onSynced?: () => Promise<void> | void;
}

/**
 * Runs the post-receipt reconciliation for a confirmed transaction.
 *
 * A failure here never means the transaction failed — chain finality is
 * already established. It means the app could not refresh its view of it, so
 * the record is retained and a warning is shown instead of a success.
 */
export async function reconcileConfirmedTransaction(
  params: ReconcileParams,
): Promise<ReconcileResult> {
  const {
    txHash,
    queryClient,
    queryKeysToInvalidate,
    syncTxBeforeInvalidate,
    syncTxHash,
    onSynced,
  } = params;

  const runInvalidation = async () => {
    if (queryKeysToInvalidate?.length) {
      await invalidateQueryKeys({ queryClient, queryKeysToInvalidate });
    }
  };

  if (syncTxBeforeInvalidate && syncTxHash) {
    try {
      await syncTxHash(txHash);
      await onSynced?.();
      await runInvalidation();
      return {
        invalidationFailed: false,
        retainPendingRecord: false,
        recoveryAction: "terminal",
      };
    } catch (error) {
      const isRefetchFailure = error instanceof QueryRefetchFailureError;
      console.error("Failed to sync confirmed tx:", {
        txHash,
        phase: isRefetchFailure ? "refetch" : "sync",
        error: isRefetchFailure ? error.cause : error,
      });

      return {
        invalidationFailed: true,
        retainPendingRecord: true,
        recoveryAction: isRefetchFailure ? "retry" : getSyncRecoveryAction(error),
      };
    }
  }

  if (queryKeysToInvalidate?.length) {
    try {
      await runInvalidation();
      return {
        invalidationFailed: false,
        retainPendingRecord: false,
        recoveryAction: "terminal",
      };
    } catch (error) {
      console.error("Failed to invalidate queries after confirmed tx:", {
        txHash,
        error,
      });
      return {
        invalidationFailed: true,
        retainPendingRecord: true,
        recoveryAction: "retry",
      };
    }
  }

  return {
    invalidationFailed: false,
    retainPendingRecord: false,
    recoveryAction: "terminal",
  };
}
