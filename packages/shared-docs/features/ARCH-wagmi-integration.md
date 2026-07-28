# [ARCH] - Wagmi Integration

## Description

Wallet connectivity uses wagmi with Reown AppKit. Config is SSR-safe and picks the chain based on environment

## Behavior

- `wagmiConfig` uses the AppKit adapter and `getAppChain`
- App providers initialize wagmi and AppKit on the client
- `Web3ConnectBtn` prompts connection when needed
- Connected-wallet status controls open AppKit's account view for wallet management, including disconnect, instead of disconnecting directly through wagmi
- Immutable contract reads should fail closed when the contract value is missing or invalid instead of silently falling back to a guessed default

## Reference implementation

```ts
export const chain = getAppChain();

const { NEXT_PUBLIC_REOWN_PROJECT_ID, NEXT_PUBLIC_CLIENT_RPC_URL } =
  getEnvConfigClient();

// The client RPC URL targets the production network. On a local chain it must be
// ignored so transactions hit the local node default rather than a remote RPC
// that has none of the locally deployed contracts.
const rpcUrl =
  chain.id === NETWORK_NAMES_MAP.LOCAL.id ? undefined : NEXT_PUBLIC_CLIENT_RPC_URL;

export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId: NEXT_PUBLIC_REOWN_PROJECT_ID,
  networks: [chain],
  transports: { [chain.id]: http(rpcUrl) },
});
```

AppKit is initialized lazily behind an `ensureAppKitInitialized()` guard so it is created once, on the client only, and callers reach it through `openAppKit()` / `subscribeAppKitEvents()` rather than holding the instance

## Related files

- `<monorepo>/apps/app/src/lib/web3/wagmiConfig.ts`
- `<monorepo>/apps/app/src/lib/web3/networkConfig.ts`
- `<monorepo>/apps/app/src/lib/web3/getAppChain.ts`
- `<monorepo>/apps/app/src/lib/web3/appKit.ts`
- `<monorepo>/apps/app/src/components/AppProviders/ProvidersClient.tsx`
- `<monorepo>/apps/app/src/components/Web3ConnectBtn/Web3ConnectBtn.tsx`
