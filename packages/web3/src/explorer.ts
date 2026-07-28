import type { Chain } from "viem";

/**
 * Returns `null` when the chain has no configured explorer — a local
 * development chain, typically. Callers render the link conditionally rather
 * than producing a dead URL.
 */
export function createExplorerUrls(chain: Chain) {
  const baseUrl = chain.blockExplorers?.default?.url;

  return {
    txUrl: (txHash: string): string | null =>
      baseUrl ? `${baseUrl}/tx/${txHash}` : null,
    addressUrl: (address: string): string | null =>
      baseUrl ? `${baseUrl}/address/${address}` : null,
  };
}
