"use client";

import { useMemo, useSyncExternalStore } from "react";
import { buildPendingTxConflictKey } from "@mydaogs/web3-tx";
import type {
  PendingTxScopeItem,
  TxSyncEntry,
  TxSyncStorage,
  TxSyncStore,
} from "@mydaogs/web3-tx";

export interface PendingTxScopeSelection {
  /** Entity ids with any non-terminal entry, for badge rendering. */
  readonly pendingEntityIds: ReadonlySet<string>;
  /** All visible entries, including terminal warnings. */
  readonly entries: readonly TxSyncEntry[];
  /**
   * Blocking entry per `entityId:conflictKey`. Present means every control
   * sharing that conflict key must be disabled.
   */
  readonly blockingEntryByConflictKey: ReadonlyMap<string, TxSyncEntry>;
  /**
   * Blocking entry per exact `actionKey`. Present means *this* control was the
   * originator and should show its own loading state.
   */
  readonly blockingEntryByActionKey: ReadonlyMap<string, TxSyncEntry>;
}

const EMPTY_STORE: TxSyncStore = {};
const getServerSnapshot = (): TxSyncStore => EMPTY_STORE;

/**
 * Built fresh rather than shared.
 *
 * `Object.freeze` does not protect a Set or Map — their contents live in
 * internal slots, so `Object.freeze(new Set()).add(x)` still mutates. A shared
 * empty singleton would therefore be poisonable by any consumer that casts away
 * the readonly types. Constructing inside `useMemo` is just as stable across
 * renders and has no shared state to protect.
 */
const emptySelection = (): PendingTxScopeSelection => ({
  pendingEntityIds: new Set<string>(),
  entries: [],
  blockingEntryByConflictKey: new Map<string, TxSyncEntry>(),
  blockingEntryByActionKey: new Map<string, TxSyncEntry>(),
});

const sameAddress = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => {
  if (!a || !b) return false;
  // Wallet libraries return EIP-55 checksummed addresses, but the persisted
  // value may have been written by a different build or a different casing
  // convention. A case-sensitive compare silently drops the entry, leaving a
  // control enabled while its transaction is still in flight.
  return a.toLowerCase() === b.toLowerCase();
};

/**
 * Pure selector over the durable registry.
 *
 * Deliberately projects nothing into server data — it exposes only which
 * actions are blocked and which control is loading. That is what keeps the
 * "no render payload" invariant intact: UI still renders chain/server truth.
 *
 * A **terminal warning entry stays visible but does not block**. It is a badge,
 * not a lock: refusing to let the user retry a failed reconciliation would
 * strand them with no way forward.
 */
export function createUsePendingTxScope(storage: TxSyncStorage) {
  return function usePendingTxScope(params?: {
    /**
     * Whose entries to admit.
     *
     * - `undefined` — address not yet known (wallet reconnecting). Admits
     *   everything, so a control does not flicker back to enabled mid-reconnect
     * - `null` — explicitly disconnected. Admits only entries that were
     *   themselves recorded without an account, so a disconnected visitor never
     *   observes another wallet's pending state on a shared browser
     * - an address — admits entries recorded without an account, plus entries
     *   matching case-insensitively
     */
    account?: `0x${string}` | null;
    /**
     * Whether `account: undefined` admits entries from every account.
     * Defaults to `true`, which keeps a control from flickering back to enabled
     * while a wallet reconnects.
     *
     * Set `false` on a shared-device surface: the window is narrow (only while
     * the address resolves) but during it a visitor does observe the previous
     * wallet's pending state.
     */
    admitUnknownAccount?: boolean;
  }): PendingTxScopeSelection {
    const store = useSyncExternalStore<TxSyncStore>(
      storage.subscribe,
      storage.getSnapshot,
      // Server render has no localStorage: no entries, so nothing is blocked.
      getServerSnapshot,
    );

    const account = params?.account;
    const admitUnknownAccount = params?.admitUnknownAccount ?? true;

    return useMemo<PendingTxScopeSelection>(() => {
      const allEntries = Object.values(store);
      if (allEntries.length === 0) return emptySelection();

      const pendingEntityIds = new Set<string>();
      const blockingEntryByConflictKey = new Map<string, TxSyncEntry>();
      const blockingEntryByActionKey = new Map<string, TxSyncEntry>();
      const visible: TxSyncEntry[] = [];

      const admits = (entry: TxSyncEntry): boolean => {
        if (account === undefined) return admitUnknownAccount;
        if (entry.account === null) return true;
        if (account === null) return false;
        return sameAddress(entry.account, account);
      };

      for (const entry of allEntries) {
        if (!admits(entry)) continue;
        visible.push(entry);
      }

      // Newest last, so a later write wins the per-key slot deterministically.
      // Without this the winner depends on object key order, which makes an
      // older superseded entry able to keep a control disabled indefinitely.
      const ordered = [...visible].sort((a, b) => a.timestamp - b.timestamp);

      for (const entry of ordered) {
        const isBlocking =
          entry.phase === "pending" || entry.phase === "reconciling";
        if (!isBlocking) continue;

        for (const item of entry.pendingItems as readonly PendingTxScopeItem[]) {
          pendingEntityIds.add(item.entityId);
          blockingEntryByConflictKey.set(
            buildPendingTxConflictKey(item.entityId, item.conflictKey),
            entry,
          );
          blockingEntryByActionKey.set(item.actionKey, entry);
        }
      }

      return {
        pendingEntityIds,
        entries: visible,
        blockingEntryByConflictKey,
        blockingEntryByActionKey,
      };
    }, [store, account, admitUnknownAccount]);
  };
}
