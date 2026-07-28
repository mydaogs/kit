/**
 * Typed vocabularies for pending-transaction scope.
 *
 * Producers (write hooks) and consumers (disabled buttons, badges) must agree
 * on these strings exactly. Declaring them as project-owned `as const` maps and
 * validating on hydration means a renamed key discards a stale record instead
 * of leaving a control permanently disabled with no matching writer.
 *
 * Projects declare their own maps and pass the guards in:
 *
 * ```ts
 * export const TX_ENTITY = { ORDER: "order", WALLET: "wallet" } as const;
 * export const TX_ACTION = { ORDER_PLACE: "order:place" } as const;
 * export const TX_CONFLICT = { ACTIVE_ORDER: "active-order" } as const;
 *
 * export const vocabulary = createTxSyncVocabulary({
 *   entities: TX_ENTITY,
 *   actions: TX_ACTION,
 *   conflicts: TX_CONFLICT,
 * });
 * ```
 */
export interface TxSyncVocabulary {
  isEntity: (value: string) => boolean;
  isAction: (value: string) => boolean;
  isConflict: (value: string) => boolean;
}

export function createTxSyncVocabulary(params: {
  entities: Record<string, string>;
  actions: Record<string, string>;
  conflicts: Record<string, string>;
  /** Extra patterns for parameterized action keys, e.g. `foo:3`. */
  dynamicActionPatterns?: readonly RegExp[];
}): TxSyncVocabulary {
  const entityValues = new Set(Object.values(params.entities));
  const actionValues = new Set(Object.values(params.actions));
  const conflictValues = new Set(Object.values(params.conflicts));
  const dynamicPatterns = params.dynamicActionPatterns ?? [];

  return {
    isEntity: (value) => entityValues.has(value),
    isAction: (value) =>
      actionValues.has(value) ||
      dynamicPatterns.some((pattern) => pattern.test(value)),
    isConflict: (value) => conflictValues.has(value),
  };
}

/**
 * Composite conflict lookup key.
 *
 * `conflictKey` answers "which controls must be disabled" — every control
 * touching the same entity-and-operation shares one. `actionKey` answers
 * "which control started this" — only the exact match restores its own spinner
 * after a reload. Keeping them separate is what lets an in-flight edit disable
 * a whole row without also claiming to be the originating button.
 */
export const buildPendingTxConflictKey = (
  entityId: string,
  conflictKey: string,
): string => `${entityId}:${conflictKey}`;
