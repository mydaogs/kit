# @mydaogs/indexer

**Onchain event projection primitives**

Storage-agnostic exactly-once projection: event hashing, an atomic-claim ledger contract, capped backoff, ordering watermarks, and a terminal-failure taxonomy that distinguishes recoverable gaps from dead letters.

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-event-processing-pipeline.md`](./ARCH-event-processing-pipeline.md)

## Install

```bash
pnpm add @mydaogs/indexer
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](https://www.npmjs.com/package/@mydaogs/shared-docs)
