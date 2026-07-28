# @mydaogs/web3-react

**Durable pending-transaction registry**

The contract-write wrapper and the durable registry behind it: cross-tab ownership via Web Locks, phased toasts, receipt reconciliation with classified retry postures, and a pure selector for which controls must be disabled.

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-contract-write-wrapper.md`](./ARCH-contract-write-wrapper.md)
- [`ARCH-durable-pending-tx-sync.md`](./ARCH-durable-pending-tx-sync.md)
- [`ARCH-pending-transactions.md`](./ARCH-pending-transactions.md)
- [`ARCH-web3-buttons.md`](./ARCH-web3-buttons.md)

## Install

```bash
pnpm add @mydaogs/web3-react
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](../shared-docs/README.md)
