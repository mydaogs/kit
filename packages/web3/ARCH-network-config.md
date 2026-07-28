# Network configuration

## Description

Chain selection is centralized and env-driven, so nothing outside this resolver names a chain directly. `createChainResolver` builds the resolver from the project's own chain map; `APP_NETWORKS` and `AppNetwork` type the network identifiers, and `NetworkChainMap` types the map

## Behavior

- The resolver picks the local chain in `development`/`test`
- Production maps the configured network name to the testnet or mainnet chain
- `resolveDeploymentBlock` follows the same split: a deployment block is required on production testnet/mainnet — an indexer's cold-start floor — but defaults to `0n` on `development`/`test`, because a local node restarts from genesis

## Reference implementation

```ts
export const APP_NETWORKS = {
  LOCAL: "LOCAL",
  TESTNET: "TESTNET",
  MAINNET: "MAINNET",
} as const;
export type AppNetwork = ValueOf<typeof APP_NETWORKS>;

// Import the three concrete chains this project targets from your chain
// library. Keeping them in one map is the point — the rest of the app never
// names a chain directly.
export const NETWORK_NAMES_MAP: Record<AppNetwork, Chain> = {
  [APP_NETWORKS.LOCAL]: localChain,
  [APP_NETWORKS.TESTNET]: testnetChain,
  [APP_NETWORKS.MAINNET]: mainnetChain,
} as const;

const resolveChain = createChainResolver(NETWORK_NAMES_MAP);

// The resolver applies this shape:
function pick(clientConfig: ChainResolverEnv) {
  switch (clientConfig.NODE_ENV) {
    case "development":
    case "test":
      return NETWORK_NAMES_MAP.LOCAL;
    case "production":
      return clientConfig.network === "mainnet"
        ? NETWORK_NAMES_MAP.MAINNET
        : NETWORK_NAMES_MAP.TESTNET;
    default:
      return NETWORK_NAMES_MAP.LOCAL;
  }
}
```
