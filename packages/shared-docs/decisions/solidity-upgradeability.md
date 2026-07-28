# [DECISION] - Solidity UUPS Upgradeability

## Context

Mutable protocol contracts use UUPS proxies so the public contract address stays stable while implementation logic can be upgraded under explicit governance

## Decision

- Mutable protocol contracts are deployed behind UUPS proxies
- Constructors disable initializers; deployment and tests must use explicit `initialize(...)` entrypoints
- A system contract owns the contract registry and the upgrade authority surface used by the ecosystem-admin gate
- A shared abstract base exposes a reusable ecosystem-admin check so system and derived contracts can guard upgrades consistently
- Operational tuning values (fees, timings) are stored onchain with role-gated setters rather than baked into the implementation
- The shared abstract base reserves a storage gap so later base fields do not shift derived storage
- Every validated deployment/upgrade starts from clean full build-info; targeted or incremental build-info is not accepted
- Deployment and upgrade manifests record proxy/implementation pairs, chain metadata, initializer or migration data, and source revision
- The proxy address is the canonical app-facing address; implementation addresses are deployment internals

## Non-proxy trust root

Value-custody contracts stay non-proxy. Their owner holds no unlimited token allowances and withdraws either the current token through `withdrawAll()` or a specific token through `withdrawToken(address)`. Both entrypoints are required because escrow settles in the token captured at the time the position was opened, even after the current token rotates

## Config snapshots

Onchain state snapshots the values in effect at each step, so a later config change cannot retroactively reprice a live agreement:

- a record snapshots its step size at creation
- a settlement fee is snapshotted when a position is accepted
- an invoice snapshots its fee at creation and accepts payment from any wallet using the current token
- a reopening clears the current settlement fee, while the offchain projection retains the historical accepted fee

## Deploy and upgrade scripts

Fresh deployment asserts post-deploy invariants across contract code, proxy implementations, registry membership, dependency wiring, token wiring, administrator setup, and every mutable config value. It requires an explicit source revision and writes timestamped plus latest JSON manifests carrying proxy/implementation pairs, initializer values, chain metadata, deployer, and source revision

The upgrade script runs either a direct validated upgrade or a prepare-only implementation deploy. It requires an explicit proxy, new-implementation FQN, and reference-contract FQN; optional calldata and narrowly scoped `unsafeAllow` values are recorded in the upgrade manifest

Validated operations require `forge clean` followed by a full compilation, because the upgrade validator rejects partial build-info. CI pins Foundry, checks formatting and lint, and runs the full test suite with upgrade validation

## Consequences

- Fresh deployments need proxy-aware initialization data and UUPS verification instead of constructor args
- Upgrade safety depends on preserving storage layout and running upgrade validation tests before broadcasting
- `missing-initializer` may be waived only for reviewed implementations with no initialization requirement; migration state uses an explicitly validated initializer
- App-facing contract addresses remain stable across logic upgrades as long as the proxy is preserved
