import type { QueryClient } from "@tanstack/react-query";

export interface IdentityScope {
  userId: string | null;
  organizationId?: string | null;
  memberId?: string | null;
}

/**
 * Collapses the caller's identity into one comparable string.
 *
 * Organization and member are part of it because the same user acting under a
 * different organization sees different data — an org switch must invalidate
 * private cache just as a sign-out does.
 */
export function getIdentityScopeKey(scope: IdentityScope | null): string {
  if (!scope?.userId) return "anon";
  return [
    scope.userId,
    scope.organizationId ?? "no-org",
    scope.memberId ?? "no-member",
  ].join(":");
}

export interface RemoveIdentityScopedQueriesOptions {
  /** Query-key roots that are safe to keep across an identity transition. */
  publicKeys: readonly string[];
  /**
   * Decides whether a query owned by an external library (wagmi, and anything
   * else that manages its own key shape) survives the transition.
   *
   * This is a **predicate over the whole key, not a root allowlist**, because
   * a root allowlist cannot express a partial carve-out — and partial is what
   * is actually needed. A wallet library's `readContract` root covers both
   * harmless chain reads and viewer-scoped financial reads under the same
   * root; keeping the root wholesale reinstates exactly the cross-identity
   * leak this function exists to prevent (deal terms fetched under one
   * identity staying readable after switching to another).
   *
   * A correct implementation validates the key shape it expects and then
   * excludes the sensitive subset, e.g.:
   *
   * ```ts
   * isRetainableExternalQuery: (queryKey) => {
   *   if (queryKey.length !== 2) return false;              // not the shape we know
   *   const [root, args] = queryKey;
   *   if (root !== "readContract") return false;
   *   if (!args || typeof args !== "object" || Array.isArray(args)) return false;
   *   return !isFinancialRead(args);                        // carve-out
   * }
   * ```
   *
   * Omit it entirely to drop every external query — the safest default.
   */
  isRetainableExternalQuery?: (queryKey: readonly unknown[]) => boolean;
  /** Root retained as `null` after sign-out to avoid an immediate refetch. */
  sessionKey?: string;
}

/**
 * Removes every cached query that is not explicitly retainable.
 *
 * **Fails closed by design.** An unrecognized key is treated as private and
 * dropped. The alternative — a denylist — leaks the moment someone adds a hook
 * and forgets to register it, and the failure is invisible: the next user on
 * that browser simply sees the previous user's data.
 */
export function removeIdentityScopedQueries(
  queryClient: QueryClient,
  options: RemoveIdentityScopedQueriesOptions,
): void {
  const publicKeys = new Set<string>(options.publicKeys);

  queryClient.removeQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      const root = queryKey[0];

      // A non-string root is a shape we do not recognize: fail closed.
      if (typeof root !== "string") return true;
      if (options.sessionKey && root === options.sessionKey) return false;
      if (publicKeys.has(root)) return false;
      if (options.isRetainableExternalQuery?.(queryKey)) return false;

      return true;
    },
  });
}
