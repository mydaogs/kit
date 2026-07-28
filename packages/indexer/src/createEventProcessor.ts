import { computeEventHash } from "./eventHash";
import { computeRetryAt, computeStatusGapRetryAt, type BackoffOptions } from "./backoff";
import {
  classifyProjectionFailure,
  PROJECTION_OUTCOME,
  type ProjectionOutcomeCode,
} from "./outcomes";

export interface EventLog {
  txHash: `0x${string}`;
  logIndex: number;
  chainId: number;
  eventName: string;
}

export type ClaimResult = "claimed" | "already-processed" | "not-due" | "locked";

/**
 * Storage the processor needs, kept as an interface so the package stays
 * ORM-agnostic. Implement it over Prisma, Drizzle, or raw SQL.
 */
export interface EventLedger {
  /**
   * Atomically transitions a row to `processing`, creating it if absent.
   *
   * MUST be a single compare-and-set. A read-then-write leaves a window where
   * two workers both observe "not processing" and both claim it.
   *
   * Returns `"not-due"` when a failed row's `nextRetryAt` is in the future or
   * null (dead letter), and `"locked"` when another worker holds a claim that
   * has not yet exceeded `claimTimeoutMs`.
   */
  claim(params: {
    eventHash: `0x${string}`;
    log: EventLog;
    claimTimeoutMs: number;
    /** Replay-path only: additionally claims a generic dead letter. */
    allowTerminal?: boolean;
  }): Promise<ClaimResult>;

  markProcessed(params: {
    eventHash: `0x${string}`;
    /** Persisted in the same write as the terminal status — no partial window. */
    cacheTagsToInvalidate: string[];
    entityType?: string;
    entityId?: string;
  }): Promise<void>;

  markSkipped(params: {
    eventHash: `0x${string}`;
    outcomeCode: ProjectionOutcomeCode;
    lastError: string;
  }): Promise<void>;

  markFailed(params: {
    eventHash: `0x${string}`;
    lastError: string;
    /** `null` writes a dead letter that the claim query stops selecting. */
    nextRetryAt: Date | null;
    outcomeCode?: ProjectionOutcomeCode | null;
    /**
     * Tags the handler requested before the failure. Persist these.
     *
     * A handler that succeeded but whose tag publish failed must be able to
     * re-emit on replay. Handlers are idempotent, so the replay's second run
     * commonly short-circuits ("already applied") and requests no tags at all —
     * at which point the only surviving copy of the manifest is this one.
     *
     * Required, not optional: an implementation that quietly drops it would
     * still typecheck while losing the invalidation permanently.
     */
    cacheTagsToInvalidate: string[];
  }): Promise<void>;

  /**
   * Tags persisted by a previous failed attempt, if any.
   *
   * Without this the manifest written by `markFailed` is unreachable and the
   * documented recovery does not exist: on replay the idempotent handler
   * short-circuits and requests no tags, publish is skipped, and the success
   * write overwrites the only surviving copy with an empty list. Peer
   * deployments then serve stale data permanently.
   */
  getPendingCacheTags(eventHash: `0x${string}`): Promise<string[]>;

  /**
   * Attempts made so far, used to compute the next backoff interval.
   *
   * **Contract: `claim` increments this before the handler runs**, so a first
   * attempt reports `1` here, not `0`. Implementations that increment on
   * failure instead will be off by one and the effective retry budget shifts.
   */
  getAttemptCount(eventHash: `0x${string}`): Promise<number>;
}

export interface ProcessorContext {
  /**
   * Collects cache tags the handler wants invalidated. Deduplicated and
   * published once, before the claim is finalized — a publish failure must
   * leave the ledger failed so the next replay re-emits them.
   */
  requestCacheTag: (tag: string) => void;
  /** Best-effort projection-health metadata. */
  setEntity: (entityType: string, entityId: string) => void;
}

export type EventHandler<TLog extends EventLog> = (
  log: TLog,
  ctx: ProcessorContext,
) => Promise<void>;

export interface CreateEventProcessorOptions<TLog extends EventLog> {
  ledger: EventLedger;
  handlers: Record<string, EventHandler<TLog>>;
  /** Decoded-but-deliberately-unprojected events. Audited, never retried. */
  ignoredEventNames?: readonly string[];
  publishCacheTags?: (tags: string[]) => Promise<void>;
  backoff?: BackoffOptions;
  /** After this, a stale `processing` row is reclaimable by another worker. */
  claimTimeoutMs?: number;
}

export interface ProcessResult {
  status: "processed" | "skipped" | "failed" | "not-claimed";
  outcomeCode?: ProjectionOutcomeCode | null;
  reason?: string;
}

/**
 * Builds the dispatcher that turns a decoded log into a projection exactly once.
 *
 * The guarantees it provides:
 *
 * - **exactly-once** via the atomic claim on `keccak256(txHash, logIndex, chainId)`
 * - **crash recovery** via reclaimable stale `processing` rows
 * - **bounded retries** with capped backoff, except status gaps which retry
 *   indefinitely because they are resolvable
 * - **no partial state** — terminal status and cache-tag manifest are one write
 */
export function createEventProcessor<TLog extends EventLog>(
  options: CreateEventProcessorOptions<TLog>,
) {
  const {
    ledger,
    handlers,
    ignoredEventNames = [],
    publishCacheTags,
    backoff,
    claimTimeoutMs = 5 * 60 * 1000,
  } = options;

  const ignored = new Set(ignoredEventNames);

  return async function processEvent(
    log: TLog,
    processOptions: { allowTerminal?: boolean } = {},
  ): Promise<ProcessResult> {
    const eventHash = computeEventHash(log);

    const claim = await ledger.claim({
      eventHash,
      log,
      claimTimeoutMs,
      allowTerminal: processOptions.allowTerminal,
    });
    if (claim !== "claimed") {
      return { status: "not-claimed", reason: claim };
    }

    // Ignored events decode fine but carry no projection. Auditing them as
    // skipped keeps them out of the failed/retry lane, where they would
    // otherwise accumulate forever and mask real failures.
    if (ignored.has(log.eventName)) {
      await ledger.markSkipped({
        eventHash,
        outcomeCode: PROJECTION_OUTCOME.IDEMPOTENT_NOOP,
        lastError: "IGNORED (audit-only event)",
      });
      return { status: "skipped", outcomeCode: PROJECTION_OUTCOME.IDEMPOTENT_NOOP };
    }

    const handler = handlers[log.eventName];
    if (!handler) {
      // A signature absent from the ABI entirely is not a failure either.
      await ledger.markSkipped({
        eventHash,
        outcomeCode: PROJECTION_OUTCOME.IDEMPOTENT_NOOP,
        lastError: "NO HANDLER (unknown signature)",
      });
      return { status: "skipped", outcomeCode: PROJECTION_OUTCOME.IDEMPOTENT_NOOP };
    }

    const requestedTags = new Set<string>();
    let entityType: string | undefined;
    let entityId: string | undefined;

    const ctx: ProcessorContext = {
      requestCacheTag: (tag) => requestedTags.add(tag),
      setEntity: (type, id) => {
        entityType = type;
        entityId = id;
      },
    };

    try {
      await handler(log, ctx);

      // Union this run's tags with any carried over from a previous attempt
      // whose publish failed. An idempotent handler commonly requests nothing
      // on replay, so the carried manifest is the only surviving copy.
      const carried = await ledger.getPendingCacheTags(eventHash);
      for (const tag of carried) requestedTags.add(tag);

      const tags = [...requestedTags];
      // Publish BEFORE finalizing. A publish failure must not mark the event
      // processed, or the invalidation is lost with nothing left to retry —
      // so it falls through to the catch below, which persists the manifest
      // alongside the failure for the replay to re-emit.
      if (tags.length > 0 && publishCacheTags) {
        await publishCacheTags(tags);
      }

      await ledger.markProcessed({
        eventHash,
        cacheTagsToInvalidate: tags,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      });

      return { status: "processed" };
    } catch (error) {
      const classified = classifyProjectionFailure(error);
      const message =
        error instanceof Error ? error.message : String(error);

      if (!classified.retryable) {
        await ledger.markSkipped({
          eventHash,
          outcomeCode: classified.outcomeCode ?? PROJECTION_OUTCOME.DEAD_LETTER,
          lastError: `${classified.lastErrorPrefix} ${message}`.trim(),
        });
        return { status: "skipped", outcomeCode: classified.outcomeCode };
      }

      const attemptCount = await ledger.getAttemptCount(eventHash);

      const nextRetryAt =
        classified.outcomeCode === PROJECTION_OUTCOME.STATUS_GAP
          ? computeStatusGapRetryAt(attemptCount, backoff)
          : computeRetryAt(attemptCount, {
              ...backoff,
              ...(classified.maxAttempts !== undefined
                ? { maxAttempts: classified.maxAttempts }
                : {}),
            });

      await ledger.markFailed({
        eventHash,
        lastError: `${classified.lastErrorPrefix} ${message}`.trim(),
        nextRetryAt,
        outcomeCode:
          nextRetryAt === null
            ? // A class with its own attempt cap keeps its identity when it
              // terminates; only an unclassified failure becomes a dead letter.
              (classified.outcomeCode ?? PROJECTION_OUTCOME.DEAD_LETTER)
            : classified.outcomeCode,
        // Carries a manifest requested before the throw, so a publish failure
        // can be re-emitted on replay even if the idempotent second run
        // requests nothing.
        cacheTagsToInvalidate: [...requestedTags],
      });

      return {
        status: "failed",
        outcomeCode: classified.outcomeCode,
        reason: message,
      };
    }
  };
}
