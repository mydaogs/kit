/**
 * Terminal-failure taxonomy.
 *
 * Distinguishing these is what makes an indexer operable. Retrying everything
 * hides bugs behind an ever-growing queue; dead-lettering everything discards
 * work that would have succeeded on the next block.
 */
export const PROJECTION_OUTCOME = {
  /** Already applied. Recorded for audit, never retried. */
  IDEMPOTENT_NOOP: "IDEMPOTENT_NOOP",
  /**
   * A required intermediate event has not been projected yet. Retried
   * indefinitely at a capped interval — it resolves itself once the gap fills,
   * so dead-lettering it would strand a recoverable projection.
   */
  STATUS_GAP: "STATUS_GAP",
  /** Handler bug or permanently bad input. Replayable by an admin. */
  DEAD_LETTER: "DEAD_LETTER",
  /** References an offchain record that no longer exists. Never retried. */
  ORPHANED: "ORPHANED",
  /**
   * Fails a deterministic provenance invariant that no replay can satisfy.
   * Reserved for exactly that — not a catch-all for handler failures.
   */
  QUARANTINED: "QUARANTINED",
  /** Contradicts offchain state in a way that needs human classification. */
  ANOMALY: "ANOMALY",
} as const;

export type ProjectionOutcomeCode =
  (typeof PROJECTION_OUTCOME)[keyof typeof PROJECTION_OUTCOME];

export type ProjectionHealthClass =
  | "APPLIED"
  | "RETRYABLE_FAILURE"
  | "PROCESSING"
  | ProjectionOutcomeCode;

export class StatusProjectionGapError extends Error {
  priorStatus: string;
  nextStatus: string;

  constructor(priorStatus: string, nextStatus: string) {
    super(`STATUS_GAP: ${priorStatus}→${nextStatus}`);
    this.name = "StatusProjectionGapError";
    this.priorStatus = priorStatus;
    this.nextStatus = nextStatus;
  }
}

export class OrphanedProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrphanedProjectionError";
  }
}

export class QuarantineProjectionError extends Error {
  reasonCode: string;

  constructor(reasonCode: string, message: string) {
    super(message);
    this.name = "QuarantineProjectionError";
    this.reasonCode = reasonCode;
  }
}

export class ProjectionAnomalyError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProjectionAnomalyError";
    this.code = code;
  }
}

export interface ClassifiedFailure {
  outcomeCode: ProjectionOutcomeCode | null;
  /** `null` means terminal — never retried. */
  retryable: boolean;
  lastErrorPrefix: string;
}

/**
 * Maps a thrown error to its disposition.
 *
 * Order matters: the specific provenance errors are checked before the generic
 * retryable fallback, so a deterministic violation never enters the retry lane.
 */
export function classifyProjectionFailure(error: unknown): ClassifiedFailure {
  if (error instanceof StatusProjectionGapError) {
    return {
      outcomeCode: PROJECTION_OUTCOME.STATUS_GAP,
      retryable: true,
      lastErrorPrefix: `STATUS_GAP: ${error.priorStatus}→${error.nextStatus}`,
    };
  }
  if (error instanceof QuarantineProjectionError) {
    return {
      outcomeCode: PROJECTION_OUTCOME.QUARANTINED,
      retryable: false,
      lastErrorPrefix: `QUARANTINED: ${error.reasonCode}`,
    };
  }
  if (error instanceof OrphanedProjectionError) {
    return {
      outcomeCode: PROJECTION_OUTCOME.ORPHANED,
      retryable: false,
      lastErrorPrefix: "ORPHANED",
    };
  }
  if (error instanceof ProjectionAnomalyError) {
    return {
      outcomeCode: PROJECTION_OUTCOME.ANOMALY,
      retryable: false,
      lastErrorPrefix: `ANOMALY: ${error.code}`,
    };
  }
  return { outcomeCode: null, retryable: true, lastErrorPrefix: "" };
}
