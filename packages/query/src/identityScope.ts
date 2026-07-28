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
   * Roots owned by wallet libraries, matched by their expected key shape.
   * Anything else unrecognized is removed.
   */
  externalKeyRoots?: readonly string[];
  /** Root retained as `null` after sign-out to avoid an immediate refetch. */
  sessionKey?: string;
}

/**
 * Removes every cached query that is not explicitly public.
 *
 * **Fails closed by design.** An unrecognized key root is treated as private
 * and dropped. The alternative — a denylist — leaks the moment someone adds a
 * hook and forgets to register it, and the failure is invisible: the next user
 * on that browser simply sees the previous user's data.
 */
export function removeIdentityScopedQueries(
  queryClient: QueryClient,
  options: RemoveIdentityScopedQueriesOptions,
): void {
  const publicKeys = new Set<string>(options.publicKeys);
  const externalRoots = new Set<string>(options.externalKeyRoots ?? []);

  queryClient.removeQueries({
    predicate: (query) => {
      const root = query.queryKey[0];
      if (typeof root !== "string") return true;
      if (options.sessionKey && root === options.sessionKey) return false;
      if (publicKeys.has(root)) return false;
      if (externalRoots.has(root)) return false;
      return true;
    },
  });
}
