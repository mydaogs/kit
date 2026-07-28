export { computeEventHash } from "./eventHash";
export {
  computeRetryAt,
  computeStatusGapRetryAt,
} from "./backoff";
export type { BackoffOptions } from "./backoff";
export { isNewerChainEvent } from "./watermark";
export type { ChainCoordinates } from "./watermark";
export {
  PROJECTION_OUTCOME,
  classifyProjectionFailure,
  StatusProjectionGapError,
  OrphanedProjectionError,
  QuarantineProjectionError,
  ProjectionAnomalyError,
} from "./outcomes";
export type {
  ProjectionOutcomeCode,
  ProjectionHealthClass,
  ClassifiedFailure,
} from "./outcomes";
export { createEventProcessor } from "./createEventProcessor";
export type {
  EventLog,
  EventLedger,
  EventHandler,
  ClaimResult,
  ProcessorContext,
  ProcessResult,
  CreateEventProcessorOptions,
} from "./createEventProcessor";
