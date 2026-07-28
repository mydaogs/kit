/**
 * Toast surface the write wrapper needs, kept as an interface so the kit does
 * not bind to one toast library or one i18n solution.
 *
 * `id` must be derived from the tx hash so pending → reconciling updates the
 * same toast in place across a live-hook → watcher handoff. Advance a
 * generation after an explicit user dismissal, otherwise a quick recreate can
 * inherit a toast the library has already marked for deletion.
 */
export interface TxToastAction {
  label: string;
  url: string;
}

export interface TxToastAdapter {
  /** Creates or updates the persistent toast for this hash. */
  show: (params: {
    txHash: `0x${string}`;
    message: string;
    action?: TxToastAction;
  }) => void;
  dismiss: (txHash: `0x${string}`) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

/** Copy the wrapper needs. Supply localized strings from the host app. */
export interface TxMessages {
  pending: (hashLabel: string) => string;
  confirmedUpdating: string;
  success: string;
  refreshWarning: string;
  reverted: string;
  submissionError: string;
  executionError: string;
  unexpectedError: string;
  viewOnExplorer: string;
}
