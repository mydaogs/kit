"use client";

import { useMemo, useSyncExternalStore } from "react";
import { selectPendingTxScope } from "@mydaogs/web3-tx";
import type {
  PendingTxScopeSelection,
  TxSyncStorage,
  TxSyncStore,
} from "@mydaogs/web3-tx";

export interface UsePendingTxScopeParams {
  /** Restrict to one entity type. Omit to admit every type. */
  entityType?: string;
  /** Ids currently on screen; entries for anything else are dropped. */
  visibleEntityIds?: Iterable<string>;
  /** Keep entries whose entity is not in `visibleEntityIds`. */
  includeUnmatchedEntries?: boolean;
  /** See `selectPendingTxScope`. `undefined` means the address is unknown. */
  account?: `0x${string}` | null;
  /** Whether an unknown account admits every entry. Defaults to `true`. */
  admitUnknownAccount?: boolean;
  /**
   * Gate for surfaces that must not render pending state until their own data
   * has settled. When `false`, `visibleEntries` is empty — blocking is
   * unaffected, because a control must stay disabled whether or not the list
   * around it is ready.
   */
  isReady?: boolean;
}

const EMPTY_STORE: TxSyncStore = {};
const getServerSnapshot = (): TxSyncStore => EMPTY_STORE;

/**
 * Binds `selectPendingTxScope` to a storage instance and React's external-store
 * subscription.
 *
 * The account is a parameter rather than read from a wallet hook here, so the
 * package does not force a wagmi dependency on consumers that resolve the
 * address another way.
 */
export function createUsePendingTxScope(storage: TxSyncStorage) {
  return function usePendingTxScope(
    params: UsePendingTxScopeParams = {},
  ): PendingTxScopeSelection {
    const store = useSyncExternalStore<TxSyncStore>(
      storage.subscribe,
      storage.getSnapshot,
      // Server render has no localStorage: no entries, so nothing is blocked.
      getServerSnapshot,
    );

    const {
      entityType,
      visibleEntityIds,
      includeUnmatchedEntries,
      account,
      admitUnknownAccount,
      isReady = true,
    } = params;

    // Callers pass a fresh array literal or Set on most renders, so identity is
    // not a usable dependency. Key on content instead — JSON rather than a
    // delimiter join, because an entity id may contain the delimiter and
    // because `[].join(" ")` and `[""].join(" ")` are the same string.
    const visibleIdsKey = visibleEntityIds
      ? JSON.stringify(Array.from(visibleEntityIds).sort())
      : null;

    return useMemo(() => {
      const selection = selectPendingTxScope({
        store,
        entityType,
        visibleEntityIds:
          visibleIdsKey === null
            ? undefined
            : (JSON.parse(visibleIdsKey) as string[]),
        includeUnmatchedEntries,
        account,
        admitUnknownAccount,
      });

      return isReady ? selection : { ...selection, visibleEntries: [] };
    }, [
      store,
      entityType,
      visibleIdsKey,
      includeUnmatchedEntries,
      account,
      admitUnknownAccount,
      isReady,
    ]);
  };
}
