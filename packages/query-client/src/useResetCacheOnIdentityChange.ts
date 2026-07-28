"use client";

import { useEffect, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  ANONYMOUS_IDENTITY,
  getIdentityScopeKey,
  removeIdentityScopedQueries,
} from "@mydaogs/query";
import type { IdentityScope, RemoveIdentityScopedQueriesOptions } from "@mydaogs/query";

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
 *
 * `removeOptions` and `persister` are read from refs, so inline object literals
 * at the call site do not retrigger the effect on every render.
 */
export function useResetCacheOnIdentityChange(params: {
  queryClient: QueryClient;
  persister: QueryPersister;
  scope: IdentityScope | null;
  isPending: boolean;
  removeOptions: RemoveIdentityScopedQueriesOptions;
  /**
   * Clear when the FIRST settled identity is anonymous, instead of adopting it
   * as a clean baseline. Defaults to `true`.
   *
   * A restored cache plus an expired session presents as "anonymous on first
   * load", which the baseline rule would treat as nothing to do — leaving the
   * previous user's persisted private queries readable by whoever is at the
   * browser now. Only set this false when the persisted cache is known to hold
   * nothing viewer-scoped.
   */
  clearOnAnonymousBaseline?: boolean;
}): boolean {
  const {
    queryClient,
    persister,
    scope,
    isPending,
    removeOptions,
    clearOnAnonymousBaseline = true,
  } = params;
  const identity = getIdentityScopeKey(scope);

  const [settledIdentity, setSettledIdentity] = useState<string | null>(null);
  const prevIdentityRef = useRef<string | null>(null);
  const hasBaselineRef = useRef(false);
  // Assigned in an effect, not the render body: a render that React discards
  // must not be able to publish a value the committed tree never saw.
  const removeOptionsRef = useRef(removeOptions);
  const persisterRef = useRef(persister);
  useEffect(() => {
    removeOptionsRef.current = removeOptions;
    persisterRef.current = persister;
  });

  useEffect(() => {
    if (isPending) return;

    if (!hasBaselineRef.current) {
      prevIdentityRef.current = identity;
      hasBaselineRef.current = true;

      // An anonymous first identity may be an expired session over a restored
      // private cache, not a fresh visitor. Purge rather than adopt.
      if (clearOnAnonymousBaseline && identity === ANONYMOUS_IDENTITY) {
        removeIdentityScopedQueries(queryClient, removeOptionsRef.current);
        void persisterRef.current.removeClient();
      }

      setSettledIdentity(identity);
      return;
    }

    if (identity !== prevIdentityRef.current) {
      prevIdentityRef.current = identity;
      removeIdentityScopedQueries(queryClient, removeOptionsRef.current);
      void persisterRef.current.removeClient();
      setSettledIdentity(identity);
    }
  }, [identity, isPending, queryClient, clearOnAnonymousBaseline]);

  return !isPending && hasBaselineRef.current && settledIdentity === identity;
}
