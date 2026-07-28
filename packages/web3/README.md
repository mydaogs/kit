# @mydaogs/web3

**Isomorphic web3 configuration**

Env-driven chain resolution, the environment-aware deployment-block refinement, bytes32 helpers, explorer URLs, and Solidity custom-error decoding. No React, so a backend can use it.

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-env-config-split.md`](./ARCH-env-config-split.md)
- [`ARCH-network-config.md`](./ARCH-network-config.md)
- [`ARCH-wagmi-integration.md`](./ARCH-wagmi-integration.md)

## Install

```bash
pnpm add @mydaogs/web3
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](../shared-docs/README.md)
