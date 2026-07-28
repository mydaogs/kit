# @mydaogs/query-client

**React client layer for `@mydaogs/query`**

The identity-scoped cache reset hook. Everything here imports React, so the whole
package is a client boundary and ships with `"use client"` on its entry

The isomorphic half — cache tiers, query-fn factories, the dehydrate filter, and
the identity-scope primitives this hook calls — lives in
[`@mydaogs/query`](../query/README.md), which has no React in its dependency
graph

## Install

```bash
pnpm add @mydaogs/query-client
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Why this is a separate package

The split is by dependency boundary, not by feature. Folded back into
`@mydaogs/query`, the bundled barrel would carry `"use client"` over
`CACHE_TIMES`, `createQueryFns` and `createShouldDehydrateQuery` as well — so a
Server Component could no longer call them, and a project with no React at all
could not use the query conventions

## The identity defense has three parts, not one

This hook is one of them. Shipping it alone leaves private payloads recoverable
from `localStorage`:

- `useResetCacheOnIdentityChange` clears the cache on an observed identity
  transition
- `createShouldDehydrateQuery` (in [`@mydaogs/query`](../query/README.md)) bounds
  what reaches disk at all
- a persister `buster` discards an incompatible cache shape

An anonymous *first* identity is treated as a transition, not a clean baseline,
because that is what an expired session over a restored cache looks like

## Cross-cutting docs

See [`@mydaogs/shared-docs`](../shared-docs/README.md)
