# @mydaogs/web3-tx

**Durable pending-transaction registry**

The durable registry behind the contract-write wrapper: cross-tab ownership via Web Locks, receipt reconciliation with classified retry postures, and the transaction vocabulary.

No React in the dependency graph — the hooks that consume this live in [`@mydaogs/web3-client`](https://www.npmjs.com/package/@mydaogs/web3-client).

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-durable-pending-tx-sync.md`](./ARCH-durable-pending-tx-sync.md)
- [`ARCH-pending-transactions.md`](./ARCH-pending-transactions.md)

## Install

```bash
pnpm add @mydaogs/web3-tx
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](https://www.npmjs.com/package/@mydaogs/shared-docs)
