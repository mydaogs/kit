"use client";

import { useSyncExternalStore } from "react";
import { buildPendingTxConflictKey } from "./vocabulary";
import type {
  PendingTxScopeItem,
  TxSyncEntry,
  TxSyncStorage,
  TxSyncStore,
} from "./txSyncStorage";

export interface PendingTxScopeSelection {
  /** Entity ids with any non-terminal entry, for badge rendering. */
  pendingEntityIds: Set<string>;
  /** All visible entries, including terminal warnings. */
  entries: TxSyncEntry[];
  /**
   * Blocking entry per `entityId:conflictKey`. Present means every control
   * sharing that conflict key must be disabled.
   */
  blockingEntryByConflictKey: Map<string, TxSyncEntry>;
  /**
   * Blocking entry per exact `actionKey`. Present means *this* control was the
   * originator and should show its own loading state.
   */
  blockingEntryByActionKey: Map<string, TxSyncEntry>;
}

const EMPTY_STORE: TxSyncStore = {};
const getServerSnapshot = (): TxSyncStore => EMPTY_STORE;

const EMPTY_SELECTION: PendingTxScopeSelection = {
  pendingEntityIds: new Set(),
  entries: [],
  blockingEntryByConflictKey: new Map(),
  blockingEntryByActionKey: new Map(),
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
     * Restrict to entries submitted by this account. Pass `undefined` while a
     * wallet is reconnecting — every account is admitted until the address
     * settles, so a control does not flicker back to enabled mid-reconnect.
     */
    account?: `0x${string}` | null;
  }): PendingTxScopeSelection {
    const store = useSyncExternalStore<TxSyncStore>(
      storage.subscribe,
      storage.getSnapshot,
      // Server render has no localStorage: no entries, so nothing is blocked.
      getServerSnapshot,
    );

    const entries = Object.values(store);
    if (entries.length === 0) return EMPTY_SELECTION;

    const account = params?.account;
    const pendingEntityIds = new Set<string>();
    const blockingEntryByConflictKey = new Map<string, TxSyncEntry>();
    const blockingEntryByActionKey = new Map<string, TxSyncEntry>();
    const visible: TxSyncEntry[] = [];

    for (const entry of entries) {
      // `account === undefined` means "not yet known" and admits everything.
      // `null` means explicitly disconnected and also admits everything, so a
      // reload before reconnect still restores blocking state.
      if (account && entry.account && entry.account !== account) continue;

      visible.push(entry);
      const isBlocking = entry.phase === "pending" || entry.phase === "reconciling";

      for (const item of entry.pendingItems as readonly PendingTxScopeItem[]) {
        if (!isBlocking) continue;
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
  };
}
