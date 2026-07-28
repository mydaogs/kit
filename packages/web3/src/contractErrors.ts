import { BaseError, ContractFunctionRevertedError } from "viem";

/**
 * Extracts the Solidity custom error name from a simulation or receipt error.
 *
 * This is what lets a write surface show "you cannot bid below the reserve"
 * instead of a generic failure string, without string-matching revert data.
 * Returns `undefined` when the error is not a decodable revert.
 */
export function getContractRevertErrorName(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined;

  const revertError = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError,
  );

  if (revertError instanceof ContractFunctionRevertedError) {
    return revertError.data?.errorName;
  }

  return undefined;
}

/**
 * Resolves a user-facing message for a failed write: a mapped override for a
 * recognized custom error, otherwise the caller's generic fallback.
 */
export function resolveContractErrorMessage(params: {
  error: unknown;
  fallback: string;
  errorNameOverrides?: Record<string, string>;
}): string {
  const errorName = getContractRevertErrorName(params.error);
  if (errorName && params.errorNameOverrides?.[errorName]) {
    return params.errorNameOverrides[errorName];
  }
  return params.fallback;
}
