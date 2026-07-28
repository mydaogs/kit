# [ARCH] - Env Config Split

## Description

Client-safe env vars and server-only env vars are separated and validated with Zod in both the browser-facing app and the backend. Client config is an explicit allowlist of `NEXT_PUBLIC_*` keys so Next.js can statically inline values

## Behavior

- `getEnvConfigClient()` parses a static allowlist of client vars
- `getEnvConfigServer()` parses all server vars
- Missing or invalid vars throw Zod errors early
- The allowlist must be written as a literal object with explicit `process.env.NEXT_PUBLIC_X` member accesses. Next inlines these only on static member access — building the object dynamically produces `undefined` in the browser bundle
- Exception — `NEXT_PUBLIC_DEPLOYMENT_BLOCK` is resolved environment-aware: required (a valid integer block number) on production testnet/mainnet, but optional on `development`/`test` where a missing/empty value defaults to `0n`. It is exposed as a `bigint` either way
- `NEXT_PUBLIC_BACKEND_API_ORIGIN` is the single shared backend origin contract for browser-facing calls, server-side backend fetches, and backend auth base URL configuration

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

## Related files

- `<monorepo>/apps/app/src/lib/config/env.ts`
- `<monorepo>/apps/backend/src/lib/config/env.ts`
- `<monorepo>/apps/*/.env.example`
