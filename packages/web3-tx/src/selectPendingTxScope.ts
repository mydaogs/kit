import { buildPendingTxConflictKey } from "./vocabulary";
import type {
  ResolvedPendingTxScopeItem,
  TxSyncEntry,
  TxSyncStore,
} from "./txSyncStorage";

/**
 * Derived from `phase` plus retry bookkeeping, so a consumer never has to know
 * that "retrying" is not a stored phase.
 */
export type PendingTxStatus = "pending" | "retrying" | "warning";

/** One item of one entry, flattened for rendering. */
export interface PendingTxScopeEntryView {
  txHash: string;
  entityType: string;
  entityId: string;
  conflictKey: string;
  actionKey: string;
  variant: ResolvedPendingTxScopeItem["variant"];
  status: PendingTxStatus;
  timestamp: number;
  account: `0x${string}` | null;
}

export interface SelectPendingTxScopeParams {
  store: TxSyncStore;
  /** Restrict to one entity type. Omit to admit every type. */
  entityType?: string;
  /**
   * Ids currently on screen. Entries for anything else are dropped unless
   * `includeUnmatchedEntries` is set — a list should not disable a control it
   * is not rendering.
   */
  visibleEntityIds?: Iterable<string>;
  /** Keep entries whose entity is not in `visibleEntityIds`. */
  includeUnmatchedEntries?: boolean;
  /**
   * Whose entries to admit.
   *
   * - an address — entries recorded without an account, plus case-insensitive
   *   matches. Wallet libraries return EIP-55 checksummed addresses while a
   *   persisted value may use another convention, and a case-sensitive compare
   *   silently drops the entry, leaving a control enabled mid-flight
   * - `null` — explicitly disconnected: only account-less entries, so a visitor
   *   never observes another wallet's pending state on a shared browser
   * - `undefined` — address not yet known, see `admitUnknownAccount`
   */
  account?: `0x${string}` | null;
  /**
   * Whether `account: undefined` admits every account. Defaults to `true`, so a
   * control does not flicker back to enabled while a wallet reconnects. Set
   * `false` on a shared-device surface.
   */
  admitUnknownAccount?: boolean;
}

export interface PendingTxScopeSelection {
  /** Everything admitted, newest first, after `replace` supersession. */
  visibleEntries: PendingTxScopeEntryView[];
  /** The subset that disables controls. Terminal warnings are excluded. */
  blockingEntries: PendingTxScopeEntryView[];
  /** Keyed `entityId:conflictKey` — present means disable every sharing control. */
  blockingEntryByConflictKey: ReadonlyMap<string, PendingTxScopeEntryView>;
  /** Keyed by exact `actionKey` — present means *this* control originated it. */
  blockingEntryByActionKey: ReadonlyMap<string, PendingTxScopeEntryView>;
  /** Pre-supersession, pre-blocking. For history surfaces. */
  allEntries: PendingTxScopeEntryView[];
}

const resolveStatus = (entry: TxSyncEntry): PendingTxStatus => {
  if (entry.phase === "warning") return "warning";
  const nextRetryAt = entry.nextRetryAt ?? 0;
  return entry.retryCount > 0 || nextRetryAt > Date.now()
    ? "retrying"
    : "pending";
};

const sameAddress = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Pure projection over the durable registry.
 *
 * Deliberately projects nothing into server data — it answers only which
 * actions are blocked and which control originated one. That is what keeps the
 * "no render payload" invariant intact: UI still renders chain and server
 * truth, so there is never a local value that can disagree with the chain.
 *
 * A **terminal warning stays visible but never blocks**. It is a badge, not a
 * lock: refusing to let the user retry a failed reconciliation would strand
 * them with no way forward.
 */
export function selectPendingTxScope(
  params: SelectPendingTxScopeParams,
): PendingTxScopeSelection {
  const {
    store,
    entityType,
    visibleEntityIds,
    includeUnmatchedEntries = false,
    account,
    admitUnknownAccount = true,
  } = params;

  const visibleIds = visibleEntityIds
    ? new Set<string>(visibleEntityIds)
    : null;

  const admits = (entry: TxSyncEntry): boolean => {
    if (account === undefined) return admitUnknownAccount;
    if (entry.account === null) return true;
    if (account === null) return false;
    return sameAddress(entry.account, account);
  };

  const allEntries: PendingTxScopeEntryView[] = [];
  for (const [txHash, entry] of Object.entries(store)) {
    if (!admits(entry)) continue;
    const status = resolveStatus(entry);

    for (const item of entry.pendingItems) {
      if (entityType !== undefined && item.entityType !== entityType) continue;
      if (
        visibleIds &&
        !includeUnmatchedEntries &&
        !visibleIds.has(item.entityId)
      ) {
        continue;
      }

      allEntries.push({
        txHash,
        entityType: item.entityType,
        entityId: item.entityId,
        conflictKey: item.conflictKey,
        actionKey: item.actionKey,
        variant: item.variant,
        status,
        timestamp: entry.timestamp,
        account: entry.account,
      });
    }
  }

  // `replace` supersession is resolved separately for visibility and for
  // blocking. A superseded entry must disappear from the badge list, but a
  // *warning* must not take the blocking slot from a newer active entry — the
  // newest overall and the newest active are not always the same record.
  const newestByConflictKey = new Map<string, PendingTxScopeEntryView>();
  const newestActiveReplace = new Map<string, PendingTxScopeEntryView>();
  const newestActiveAdditive = new Map<string, PendingTxScopeEntryView>();

  for (const view of allEntries) {
    const key = buildPendingTxConflictKey(view.entityId, view.conflictKey);
    const isActive = view.status !== "warning";

    if (view.variant === "replace") {
      const prior = newestByConflictKey.get(key);
      if (!prior || prior.timestamp <= view.timestamp) {
        newestByConflictKey.set(key, view);
      }
      if (isActive) {
        const priorActive = newestActiveReplace.get(key);
        if (!priorActive || priorActive.timestamp <= view.timestamp) {
          newestActiveReplace.set(key, view);
        }
      }
    } else if (isActive) {
      const priorActive = newestActiveAdditive.get(key);
      if (!priorActive || priorActive.timestamp <= view.timestamp) {
        newestActiveAdditive.set(key, view);
      }
    }
  }

  const visibleEntries = allEntries
    .filter(
      (view) =>
        view.variant === "additive" ||
        newestByConflictKey.get(
          buildPendingTxConflictKey(view.entityId, view.conflictKey),
        ) === view,
    )
    .sort((left, right) => right.timestamp - left.timestamp);

  const blockingEntryByConflictKey = new Map([
    ...newestActiveReplace,
    ...newestActiveAdditive,
  ]);
  const blockingEntries = Array.from(blockingEntryByConflictKey.values());

  const blockingEntryByActionKey = new Map<string, PendingTxScopeEntryView>();
  for (const view of allEntries) {
    if (view.status === "warning") continue;
    const prior = blockingEntryByActionKey.get(view.actionKey);
    if (!prior || prior.timestamp <= view.timestamp) {
      blockingEntryByActionKey.set(view.actionKey, view);
    }
  }

  return {
    visibleEntries,
    blockingEntries,
    blockingEntryByConflictKey,
    blockingEntryByActionKey,
    allEntries,
  };
}
