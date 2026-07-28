import type { Query } from "@tanstack/react-query";

export interface DehydrateFilterOptions {
  /**
   * Query-key roots that must never be written to disk.
   *
   * Two classes belong here: financial/deal-terms reads, and any payload the
   * server derives from the caller's cookie under a key that does not itself
   * identify that caller (conversation-scoped state, participation-filtered
   * lists, viewer-shaped summaries).
   */
  excludedKeyRoots: readonly string[];
  /** Roots owned by wallet libraries, excluded wholesale. */
  excludedExternalRoots?: readonly string[];
}

/**
 * Builds the `shouldDehydrateQuery` predicate for a persisted query cache.
 *
 * This is the **second half** of the identity-transition defense and is not
 * optional. `useResetCacheOnIdentityChange` clears on a transition it observes;
 * this bounds what a hook that forgets to gate itself can leave on disk in the
 * first place. Shipping one without the other leaves private payloads
 * recoverable from `localStorage`.
 *
 * Also excludes pending queries and anything in an error state: a half-resolved
 * or failed entry restores as authoritative-looking data with no request behind
 * it.
 */
export function createShouldDehydrateQuery(options: DehydrateFilterOptions) {
  const excluded = new Set<string>([
    ...options.excludedKeyRoots,
    ...(options.excludedExternalRoots ?? []),
  ]);

  return (query: Query): boolean => {
    if (query.state.status !== "success") return false;
    if (query.state.fetchStatus === "fetching") return false;

    const root = query.queryKey[0];
    if (typeof root !== "string") return false;
    return !excluded.has(root);
  };
}
