import { encodePacked, keccak256 } from "viem";

/**
 * Stable identity for a single onchain log.
 *
 * `(txHash, logIndex, chainId)` is the only tuple that is unique and stable
 * across replays, reorg-free redelivery, and multiple chains sharing one
 * database. Hashing it gives a fixed-width primary key for the claim ledger.
 */
export function computeEventHash(params: {
  txHash: `0x${string}`;
  logIndex: number;
  chainId: number;
}): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "uint256", "uint256"],
      [params.txHash, BigInt(params.logIndex), BigInt(params.chainId)],
    ),
  );
}
