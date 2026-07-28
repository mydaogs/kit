"use client";

import { useEffect, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { getIdentityScopeKey, removeIdentityScopedQueries } from "./identityScope";
import type { IdentityScope, RemoveIdentityScopedQueriesOptions } from "./identityScope";

export interface QueryPersister {
  removeClient: () => Promise<void> | PromiseLike<void> | void;
}

/**
 * Central watcher that clears private cache on any identity transition.
 *
 * A persisted query cache keyed by static strings would otherwise restore the
 * previous user's private data for the next user on the same browser. Rather
 * than scoping every key or maintaining a denylist, one watcher observes the
 * identity and drops everything not explicitly public.
 *
 * The first observed session is a **baseline, not a transition** — on reload it
 * is the identity restored from storage, and clearing there would throw away a
 * valid warm cache on every visit.
 *
 * Returns whether the cache has settled for the current identity. Authenticated
 * observers should wait on this before issuing requests, otherwise a query can
 * start and be immediately removed by the same transition.
 */
export function useResetCacheOnIdentityChange(params: {
  queryClient: QueryClient;
  persister: QueryPersister;
  scope: IdentityScope | null;
  isPending: boolean;
  removeOptions: RemoveIdentityScopedQueriesOptions;
}): boolean {
  const { queryClient, persister, scope, isPending, removeOptions } = params;
  const identity = getIdentityScopeKey(scope);

  const [settledIdentity, setSettledIdentity] = useState<string | null>(null);
  const prevIdentityRef = useRef<string | null>(null);
  const hasBaselineRef = useRef(false);

  useEffect(() => {
    if (isPending) return;

    if (!hasBaselineRef.current) {
      prevIdentityRef.current = identity;
      hasBaselineRef.current = true;
      setSettledIdentity(identity);
      return;
    }

    if (identity !== prevIdentityRef.current) {
      prevIdentityRef.current = identity;
      removeIdentityScopedQueries(queryClient, removeOptions);
      void persister.removeClient();
      setSettledIdentity(identity);
    }
  }, [identity, isPending, persister, queryClient, removeOptions]);

  return !isPending && hasBaselineRef.current && settledIdentity === identity;
}
