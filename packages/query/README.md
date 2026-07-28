# @mydaogs/query

**TanStack Query conventions**

Named cache tiers, query-function factories bound to a transport, and both halves of the identity-transition defense: a fail-closed cache reset and a dehydration filter that bounds what reaches disk.

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-query-error-boundary.md`](./ARCH-query-error-boundary.md)
- [`ARCH-query-invalidation-pattern.md`](./ARCH-query-invalidation-pattern.md)
- [`ARCH-tanstack-query-integration.md`](./ARCH-tanstack-query-integration.md)
- [`pagination-rules.md`](./pagination-rules.md)

## Install

```bash
pnpm add @mydaogs/query
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](../shared-docs/README.md)
