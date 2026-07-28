# [ARCH] - TanStack Query Integration

## Description

Client data fetching uses TanStack Query with consent-gated localStorage persistence, shared cache times, and consistent query key helpers

## Behavior

- QueryClient configured in app providers
- Cache time presets live in `queryConfig.ts` as named tiers (`NO_CACHE` for chain reads, then short/medium/stable/long/day tiers)
- Query keys centralized in `lib/hooks/keys.ts`
- Mutations invalidate relevant keys and use optimistic cache helpers where needed
- Static reference reads use a 24-hour `staleTime` rather than an infinite one, so the backend cache stays the freshness boundary and a client that stays open for days still eventually re-reads
- Admin queues whose rows are moved by cron rather than by the viewer set an explicit `refetchInterval` and re-enable `refetchOnWindowFocus`, which the global default turns off
- Server actions invalidate server-side cache tags with `updateTag()` for actor-visible reads. Backend route handlers, auth hooks, indexer jobs, and other cross-user fanout paths use `revalidateTag(..., { expire: 0 })` and return safe `cacheTags` through the response envelope so the calling wrapper can invalidate the actor's cache immediately
- After those actions complete, client code invalidates the matching query keys rather than calling `router.refresh()`
- Shared query fetch helpers parse API payloads through the `bigIntJson` reviver so cached route data can preserve `bigint` fields
- Offline persistence uses the same `bigIntJson` serializer and reviver so dehydrated cache payloads and bigint-based query keys remain client-safe
- Global `refetchOnMount` is `true`, not `"always"`, so warm revisits respect each query's `staleTime` instead of fighting the persistence layer
- Persisted query state is capped at 24 hours and uses a static buster; bump the buster when a deployment changes persisted query shapes or the cache privacy classification incompatibly

## Persistence privacy model

Two classes of query root are excluded from the snapshot entirely: protected financial keys (plus contract reads wholesale), and identity-sensitive keys — payloads the server derives from the caller's cookie under a key that does not fully identify that caller

That exclusion is a backstop, not the gate. Hooks that fetch cookie-derived data call `useIdentityConfirmed()` and refuse to run while the session is reconciling (a persisted session restores as settled while the fresh read is in flight) or unverifiable (a failed read is unknown identity, not a guest). Disabled observers still return restored data, so hooks holding sensitive payloads mask `data` as well as disabling the request. The persistence exclusion bounds what a hook that forgets can leave behind

On sign-out and identity changes, remove every query except the explicit public/session allowlist and explicit wagmi query roots with their expected key shape. Unknown application roots **fail closed** and are removed; the session entry is retained as `null` after sign-out to avoid an immediate refetch

Optional persistence is gated by a cookie-consent category and excludes pending queries plus transaction receipt lookups from dehydration

## Restore ordering

After persistence restoration, the provider starts one fire-and-forget authoritative session fetch with `staleTime: 0` before observers leave restore mode; it does not await the fetch, so public queries remain parallel. Session consumers use shared query options without forced mount refetches, and restore-sensitive routes use `useIsRestoring()` rather than `isFetchedAfterMount`

Identity-scoped query cleanup exposes a provider-owned settled signal. Authenticated reads wait until the synchronous private-query removal for the current identity has completed, preventing an observer from starting a request that the same transition immediately removes

Presentation may retain an animated previous role, but request enablement must receive an authoritative, non-fetching role boolean; animated UI state and restored session data must never gate authenticated network queries

## Duplicate-mutation guards

A preference write that a session refetch can re-trigger uses a module-level keyed promise map plus an optimistic session patch, preventing Suspense remounts and late stale session data from issuing duplicate mutations while allowing a conditional rollback on failure. A fulfilled entry remains for a short keyed window, so a session refetch that has not yet observed the server write reapplies the optimistic value but cannot issue a duplicate request. Both tagged failures and rejected transport calls enter the same keyed cooldown, so rollback cannot create a self-sustaining request loop or an unhandled rejection

Pending transaction workers wait for the initial authoritative auth result, then remain mounted through routine background session refetches. A module-level hash set prevents a remount from duplicating an in-flight reconciliation

## Related files

- `<monorepo>/apps/app/src/lib/config/queryConfig.ts`
- `<monorepo>/apps/app/src/components/AppProviders/ProvidersClient.tsx`
- `<monorepo>/apps/app/src/lib/hooks/keys.ts`
- `<monorepo>/apps/app/src/lib/hooks/useSession.ts`
- `<monorepo>/apps/app/src/lib/hooks/useResetCacheOnIdentityChange.ts`
- `<monorepo>/apps/app/src/lib/hooks/removeIdentityScopedQueries.ts`
- `<monorepo>/apps/app/src/lib/utils/createQueryFn.ts`
- `<monorepo>/apps/app/src/lib/utils/identityScope.ts`
