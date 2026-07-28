import type { Chain } from "viem";

export const APP_NETWORKS = {
  LOCAL: "LOCAL",
  TESTNET: "TESTNET",
  MAINNET: "MAINNET",
} as const;

export type AppNetwork = (typeof APP_NETWORKS)[keyof typeof APP_NETWORKS];

export type NetworkChainMap = Record<AppNetwork, Chain>;

export interface ChainResolverEnv {
  NODE_ENV: "development" | "test" | "production";
  NEXT_PUBLIC_NETWORK: "testnet" | "mainnet";
}

/**
 * Single place that answers "which chain am I on".
 *
 * Local and test always resolve to the local chain regardless of the network
 * env var, so a stray production value in a dev shell cannot point wallet
 * writes at a real network.
 */
export function createChainResolver(chains: NetworkChainMap) {
  return function getAppChain(env: ChainResolverEnv): Chain {
    switch (env.NODE_ENV) {
      case "development":
      case "test":
        return chains.LOCAL;
      case "production":
        return env.NEXT_PUBLIC_NETWORK === "mainnet"
          ? chains.MAINNET
          : chains.TESTNET;
      default:
        return chains.LOCAL;
    }
  };
}

/**
 * A client RPC URL targets the production network only. On a local chain it
 * must be ignored so writes hit the local node default rather than a remote
 * RPC that has none of the locally deployed contracts.
 */
export function resolveRpcUrl(params: {
  chain: Chain;
  localChain: Chain;
  clientRpcUrl?: string;
}): string | undefined {
  return params.chain.id === params.localChain.id
    ? undefined
    : params.clientRpcUrl;
}
