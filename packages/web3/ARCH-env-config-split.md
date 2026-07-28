# Env config split

## Description

Client-safe and server-only environment variables are separated and validated with zod. `createEnvConfig` builds the parsers; the project supplies the schemas.

The client half must be an explicit allowlist, because a bundler can only inline what it can see statically

## Behavior

- The client parser reads a static allowlist of public vars
- The server parser reads everything
- Missing or invalid vars throw at startup, not at first use
- **The allowlist must be a literal object with explicit `process.env.X` member accesses.** Bundlers inline only on static member access; building the object dynamically yields `undefined` in the browser bundle, with no error to say so
- `resolveDeploymentBlock` is environment-aware: a valid integer block number is required on production testnet/mainnet, optional on `development`/`test` where an empty value becomes `0n`. It is exposed as a `bigint` either way
- One variable should be the single backend-origin contract, shared by browser calls, server-side fetches, and auth base-URL configuration. Splitting it across several is how the halves drift apart

## Environment-aware refinement

```ts
function resolveDeploymentBlock<T extends {
  NODE_ENV: "development" | "test" | "production";
  NEXT_PUBLIC_DEPLOYMENT_BLOCK?: string;
}>(data: T, ctx: z.RefinementCtx) {
  const raw = data.NEXT_PUBLIC_DEPLOYMENT_BLOCK?.trim();
  const isLocal = data.NODE_ENV === "development" || data.NODE_ENV === "test";

  if (!raw) {
    if (isLocal) return { ...data, NEXT_PUBLIC_DEPLOYMENT_BLOCK: 0n };
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["NEXT_PUBLIC_DEPLOYMENT_BLOCK"],
      message: "Required on production (testnet/mainnet).",
    });
    return z.NEVER;
  }

  try {
    return { ...data, NEXT_PUBLIC_DEPLOYMENT_BLOCK: BigInt(raw) };
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["NEXT_PUBLIC_DEPLOYMENT_BLOCK"],
      message: "Must be an integer block number.",
    });
    return z.NEVER;
  }
}

const clientEnvSchema = clientEnvObject.transform(resolveDeploymentBlock);
```

A client-exposed RPC URL reaches the browser bundle, so lock it down with provider-side origin allowlists and treat it as public. Leaving it unset falls back to the chain's rate-limited public default
