import type { z } from "zod";

/**
 * Environment-aware resolution for the indexer cold-start floor.
 *
 * A local node restarts from genesis, so a deployment block is meaningless
 * there and defaults to `0n`. Production must supply a real integer: setting
 * the floor above the true deploy block skips every event in between
 * permanently, and a pruned database leaves nothing to notice the loss against.
 *
 * Wire it as a `.transform()` on the env object schema so the parsed config
 * exposes a `bigint` rather than a string every caller re-parses.
 */
export function resolveDeploymentBlock<
  T extends {
    NODE_ENV: "development" | "test" | "production";
    NEXT_PUBLIC_DEPLOYMENT_BLOCK?: string;
  },
>(
  data: T,
  ctx: z.RefinementCtx,
): Omit<T, "NEXT_PUBLIC_DEPLOYMENT_BLOCK"> & {
  NEXT_PUBLIC_DEPLOYMENT_BLOCK: bigint;
} {
  const raw = data.NEXT_PUBLIC_DEPLOYMENT_BLOCK?.trim();
  const isLocal = data.NODE_ENV === "development" || data.NODE_ENV === "test";

  if (!raw) {
    if (isLocal) return { ...data, NEXT_PUBLIC_DEPLOYMENT_BLOCK: 0n };
    ctx.addIssue({
      code: "custom",
      path: ["NEXT_PUBLIC_DEPLOYMENT_BLOCK"],
      message: "Required on production (testnet/mainnet).",
    });
    return null as never;
  }

  try {
    return { ...data, NEXT_PUBLIC_DEPLOYMENT_BLOCK: BigInt(raw) };
  } catch {
    ctx.addIssue({
      code: "custom",
      path: ["NEXT_PUBLIC_DEPLOYMENT_BLOCK"],
      message: "Must be an integer block number.",
    });
    return null as never;
  }
}
