# @mydaogs/web3-client

**React client layer for `@mydaogs/web3-tx`**

The contract-write wrapper and the pending-scope selector: phased toasts, receipt
reconciliation, and a pure selector for which controls must be disabled.
Everything here imports React, so the whole package is a client boundary and
ships with `"use client"` on its entry

The durable registry underneath — storage, reconciliation, vocabulary, and the
toast adapter contract — lives in [`@mydaogs/web3-tx`](https://www.npmjs.com/package/@mydaogs/web3-tx),
which has no React in its dependency graph

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-contract-write-wrapper.md`](./ARCH-contract-write-wrapper.md)
- [`ARCH-web3-buttons.md`](./ARCH-web3-buttons.md)

## Install

```bash
pnpm add @mydaogs/web3-client
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Why this is a separate package

The split is by dependency boundary, not by feature. The registry in
`@mydaogs/web3-tx` is useful without React — a worker reconciling receipts, or a
server projecting transaction state, needs the storage contract and the recovery
taxonomy but no hooks. Keeping them together would force React into that graph,
and would put `"use client"` over the registry as well

## Invariants worth preserving

- **Durable settlement and callbacks are fenced separately.** Settlement must
  complete after the surface unmounts or the record leaks; callbacks belong to
  the mounted surface and cannot transfer to a watcher
- **Cross-tab ownership is queued before the durable record is written.**
  Otherwise a watcher woken by the storage event can overtake the submitting hook
  in the lock queue and reconcile a transaction whose callbacks live in another
  tab
- **The registry stores no render payload.** UI shows server or chain truth until
  reconciliation refetches it, so there is never a local value that can disagree
  with the chain

## Cross-cutting docs

See [`@mydaogs/shared-docs`](https://www.npmjs.com/package/@mydaogs/shared-docs)
