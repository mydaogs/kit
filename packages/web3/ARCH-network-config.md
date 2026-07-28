# [ARCH] - Network Config

## Description

Web3 network selection is centralized and driven by env config. Local dev uses the local chain, production uses `NEXT_PUBLIC_NETWORK`

## Behavior

- `getAppChain` picks the local chain in `development`/`test`
- Production maps `NEXT_PUBLIC_NETWORK` to the testnet or mainnet chain
- `NEXT_PUBLIC_DEPLOYMENT_BLOCK` follows the same split: required on production testnet/mainnet (the cron reconciler's cold-start floor), but defaults to `0n` on `development`/`test` because the local node restarts from genesis. The cron reconciler also pins it to `0n` directly when the resolved chain is the local one

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

export function getAppChain() {
  const clientConfig = getEnvConfigClient();
  switch (clientConfig.NODE_ENV) {
    case "development":
    case "test":
      return NETWORK_NAMES_MAP.LOCAL;
    case "production":
      return clientConfig.NEXT_PUBLIC_NETWORK === "mainnet"
        ? NETWORK_NAMES_MAP.MAINNET
        : NETWORK_NAMES_MAP.TESTNET;
    default:
      return NETWORK_NAMES_MAP.LOCAL;
  }
}
```

## Related files

- `<monorepo>/apps/backend/src/lib/web3/networkConfig.ts`
- `<monorepo>/apps/backend/src/lib/web3/getAppChain.ts`
- `<monorepo>/apps/app/src/lib/web3/wagmiConfig.ts` (browser-only; backend uses viem directly)
- `<monorepo>/apps/backend/src/lib/web3/viemClient.ts`
- `<monorepo>/apps/backend/src/lib/config/env.ts`
