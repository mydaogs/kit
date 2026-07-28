# [ARCH] - React Cache Pattern

## Description

Two server caching layers are used: React `cache()` for in-render deduplication, and Next.js `"use cache"` with `cacheTag()` for cross-request caching and tag-based invalidation

## Behavior

- `cache()` dedupes identical calls within a single render only
- `"use cache"` persists across requests and must register tags for invalidation
- Cached `src/data/*` reads should call exactly one explicit `cacheLife()` profile from app config in addition to `cacheTag()`
- Define named profiles per read class (for example a fast-moving detail profile, a public directory profile, an actor-scoped profile, an admin workflow profile, a long-lived reference profile) and keep every declared profile in use
- Where a cached read feeds a route that then enriches it from a different domain, cache only the part the tag actually covers and keep the enrichment in the route — otherwise a write path that never bumps that tag leaves stale data behind
- A route that delegates to a cached function must `await connection()` first
- Mutations use `updateTag()` from server actions for read-your-own-writes freshness and `revalidateTag(..., "max")` from route handlers, indexers, hooks, and other broad fanout contexts
- The React Compiler is enabled, so client component work should not add manual memoization unless profiling proves it is needed; server cache invalidation stays explicit

## Related files

- `<monorepo>/apps/backend/src/data/**`
- `<monorepo>/apps/backend/src/app/data/**`
