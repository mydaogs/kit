import { actionErrorToThrowable } from "@mydaogs/contract";

/**
 * The envelope a sync attempt returns. Structural rather than importing the
 * action-response type, so a project whose sync is a plain fetch can satisfy it
 * without adopting the whole contract package.
 */
export interface TxSyncAttempt<TCode extends string = string> {
  success: boolean;
  errorMessage?: string;
  errorCode?: TCode;
  errorParams?: Record<string, string | number>;
  errorStatus?: number;
}

export interface TxSyncRetryOptions {
  /** Attempts after the first. Ignored when `maxElapsedMs` is set. */
  retryCount?: number;
  /** Delay before the first retry. The initial attempt is always immediate. */
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  /**
   * Elapsed-time budget. When set it **replaces** count-based exhaustion:
   * retries continue while time remains, and a final attempt is guaranteed
   * right at the deadline even when the next backoff delay would overshoot it.
   *
   * Prefer this over a count for contention that resolves on someone else's
   * schedule — an indexer lease clears when it clears, and three attempts at
   * 1.5× backoff is a budget of about four seconds, which says nothing useful
   * about whether the lease is still held.
   */
  maxElapsedMs?: number;
}

const DEFAULTS = {
  retryCount: 3,
  delayMs: 1000,
  backoffMultiplier: 1.5,
  maxDelayMs: 5000,
} as const;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export interface CreateBudgetedTxSyncOptions<TCode extends string = string> {
  /** One sync attempt. Must not retry internally — this wrapper owns that. */
  attempt: (txHash: `0x${string}`) => Promise<TxSyncAttempt<TCode>>;
  /**
   * Error codes worth waiting out. Anything else fails immediately, because
   * retrying a deterministic rejection only burns the budget.
   */
  retryOn?: readonly TCode[];
  retry?: TxSyncRetryOptions | false;
  /**
   * What to do when the budget runs out on a retryable code.
   *
   * `true` (the default) throws, so the caller records the failure, retains the
   * pending record and can resume after a reload. `false` returns quietly and
   * treats the sync as done — only correct when a later reconciliation is
   * guaranteed by something else.
   */
  throwOnExhausted?: boolean;
}

/**
 * Wraps a single-shot backend sync in a retry budget, producing the
 * `syncTxHash` that `reconcileConfirmedTransaction` expects.
 *
 * This exists because "the backend is already syncing this transaction" is not
 * a failure — it is contention on a lease held by an indexer run that will
 * finish. Failing on the first such response surfaces a spurious refresh
 * warning for a transaction that is already final onchain, and the projected
 * reads stay stale until something else happens to invalidate them.
 *
 * On exhaustion the thrown error preserves `code` and `params` via
 * `actionErrorToThrowable`, so `getSyncRecoveryAction` still classifies it as
 * retryable and the durable record survives for a later attempt.
 */
export function createBudgetedTxSync<TCode extends string = string>(
  options: CreateBudgetedTxSyncOptions<TCode>,
): (txHash: `0x${string}`) => Promise<void> {
  const {
    attempt,
    retryOn = ["SYNC_IN_PROGRESS" as TCode],
    retry,
    throwOnExhausted = true,
  } = options;

  const config =
    retry === false
      ? { ...DEFAULTS, retryCount: 0 }
      : { ...DEFAULTS, ...(retry ?? {}) };

  const retryable = new Set<string>(retryOn);

  return async function syncTxHash(txHash: `0x${string}`): Promise<void> {
    const startedAt = Date.now();
    let attempts = 0;
    let delay = config.delayMs;

    for (;;) {
      const result = await attempt(txHash);
      if (result.success) return;

      if (result.errorCode && retryable.has(result.errorCode)) {
        let willRetry = false;

        if (config.maxElapsedMs !== undefined) {
          const remaining = config.maxElapsedMs - (Date.now() - startedAt);
          if (remaining > 0) {
            // Clamp to the remaining budget so the deadline always gets one
            // last attempt instead of being skipped past by the backoff.
            await wait(Math.min(delay, remaining));
            willRetry = true;
          }
        } else if (attempts < config.retryCount) {
          await wait(delay);
          attempts += 1;
          willRetry = true;
        }

        if (willRetry) {
          delay = Math.min(
            config.maxDelayMs,
            Math.ceil(delay * config.backoffMultiplier),
          );
          continue;
        }

        if (!throwOnExhausted) return;
      }

      throw actionErrorToThrowable({
        errorMessage: result.errorMessage ?? "Transaction sync failed",
        errorCode: result.errorCode,
        errorParams: result.errorParams,
        errorStatus: result.errorStatus,
      });
    }
  };
}
