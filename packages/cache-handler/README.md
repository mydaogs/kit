# @mydaogs/cache-handler

**Distributed Next.js cache handler**

Routes tag-invalidation timestamps through a shared Redis store so peer deployments observe each other's invalidations, plus an explicit publisher for cross-app fanout and a cache-tag registry with envelope/internal partitioning.

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-react-cache-pattern.md`](./ARCH-react-cache-pattern.md)
- [`cache-handlers-shared-store.md`](./cache-handlers-shared-store.md)

## Install

```bash
pnpm add @mydaogs/cache-handler
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](https://www.npmjs.com/package/@mydaogs/shared-docs)
