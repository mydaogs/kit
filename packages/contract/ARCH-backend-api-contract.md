# [ARCH] - Backend API Contract

## Description

The standalone `apps/backend` service exposes a small versioned contract for health checks, auth, reads, writes, cron, and webhooks. The browser app talks to it directly over HTTP instead of routing browser reads through local API routes. The contract is intentionally focused on deployment boundaries and transport rules rather than DTO schemas for every endpoint

## Routes

- `/health` - build and runtime health probe returning the backend contract version
- `/auth/*` - auth library endpoints and plugins
- `/data/*` - browser-facing read and write endpoints
- `/public-data/*` - audited session-independent GET endpoints that may be shared by the CDN. Every base path must be registered in `PUBLIC_BACKEND_GET_PATHS` before `publicBackendFetch` will accept it
- `/cron/*` - bearer-authenticated cron handlers
- `/webhooks/*` - signed third-party and internal webhook handlers

## The three contract mechanisms

**1. Build-time version probe.** The consumer's fetch wrapper probes `/health` once during a production build and throws if `contractVersion` does not match its compiled-in constant. A split deploy fails the build instead of failing at runtime

```ts
if (body.contractVersion !== BACKEND_CONTRACT_VERSION) {
  throw new BackendContractMismatchError(
    BACKEND_CONTRACT_VERSION,
    body.contractVersion,
  );
}
```

The probe tolerates a `503` when the body is valid and the version matches, so a degraded database does not block a deploy

**2. Path-to-response type map.** A single interface maps every route to its response type, so the fetch wrapper is checked end to end with no codegen and no RPC framework

```ts
export interface BackendDataResponses {
  "/data/getEntity": EntityDto;
  "/data/updateEntity": null;
  "/data/getEntityList": EntityListPage;
}
```

**3. Public-path allowlist.** The credential-free lane is a literal `as const` tuple, and a template type derives the legal query-string forms:

```ts
export const PUBLIC_BACKEND_GET_PATHS = [
  "/public-data/getPublicProfileById",
] as const;

export type PublicBackendGetBasePath = (typeof PUBLIC_BACKEND_GET_PATHS)[number];
export type PublicBackendGetPath =
  | PublicBackendGetBasePath
  | `${PublicBackendGetBasePath}?${string}`;
```

`publicBackendFetch` validates the base path at runtime and throws on any body, non-GET method, credential override, or custom header — so the lane cannot drift into preflighting or leaking cookies

## Response envelope

```ts
type ApiResponse<TData = unknown> =
  | { success: true; data: TData; cacheTags?: string[] }
  | {
      success: false;
      errorMessage: string;
      errorCode?: BackendErrorCode;
      errorParams?: Record<string, string | number>;
    };
```

The backend sanitizes its error messages: only deliberate business/auth errors carry a descriptive message, everything unexpected collapses to a generic string server-side. That is what makes `errorMessage` safe to surface

## Contract hygiene

The contract package must not import the database package. Enforce it as a package script so a stray import fails CI rather than review

## Related files

- `<monorepo>/packages/backend-contract/src/index.ts`
- `<monorepo>/packages/backend-contract/src/errors.ts`
- `<monorepo>/apps/app/src/lib/backend/client.ts`
