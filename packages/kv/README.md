# @mydaogs/kv

**Redis client with lazy env resolution**

A single Redis singleton behind a Proxy so `process.env` is read at first request rather than module load. Two entrypoints: `./rest` for code that loads during build-time tracing (the cache handler), the default for ordinary application code that should fail fast at startup.

## Install

```bash
pnpm add @mydaogs/kv
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](https://www.npmjs.com/package/@mydaogs/shared-docs)
