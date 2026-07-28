# Versioned backend wire contract

## Description

A browser app talking to a separately deployed backend over HTTP carries two
standing risks: the halves drifting apart across a split deploy, and a "public"
endpoint quietly gaining credentials. This package addresses both with
mechanisms rather than conventions

## 1. Build-time version probe

`createContractVerifier` probes a health endpoint **once during a production
build** and throws `BackendContractMismatchError` if the reported
`contractVersion` does not match the constant compiled into the consumer. A
split deploy fails the build instead of failing in front of users

```ts
const verifyContract = createContractVerifier({
  expectedVersion: BACKEND_CONTRACT_VERSION,
  expectedApp: "backend",
  healthUrl: () => `${origin}/health`,
  // Required, and build-time on purpose: running this per request makes a
  // network probe a dependency of every request.
  shouldVerify: () => process.env.NEXT_PHASE === "phase-production-build",
});
```

Two details that are easy to get wrong:

- **Success is memoized; failure is not.** Caching a rejected promise makes one
  transient health blip permanent for the process lifetime, rejecting every
  later request with a failure it cannot retry
- **A `503` with a valid, version-matching body passes.** A degraded database
  should not block the deploy of a correctly-versioned backend

`isBackendHealthResponse` narrows the probe body; `BackendHealthResponse` types it

## 2. Path-to-response type map

The consumer declares one interface mapping route to response type, so the fetch
wrapper is checked end to end with no codegen and no RPC framework:

```ts
interface BackendDataResponses {
  "/data/getEntity": EntityDto;
  "/data/updateEntity": null;
}
```

## 3. The public lane is enforced, not documented

`createPublicPathValidator` builds a validator over an `as const` tuple of
allowed base paths, and `PublicPathOf` derives the legal query-string forms:

```ts
const PUBLIC_GET_PATHS = ["/public-data/getProfileById"] as const;
```

The public fetcher **throws at runtime** on a body, a non-GET method, a
credential override, or a custom header. A lane that is only documented as
credential-free drifts into sending cookies or triggering a preflight; one that
throws cannot

## 4. The credentialed fetcher pins the resolved origin

`createBackendFetch` resolves every request against the configured origin and
compares once, because `credentials: "include"` would otherwise forward the
session cookie wherever a caller names

Pinning only inputs that *look* absolute is insufficient. `//evil.example/x`,
`\\evil.example/x` and `\/evil.example/x` all resolve to a foreign host while
inheriting the scheme, because WHATWG URL normalizes backslashes for special
schemes

Both lanes validate the **resolved** URL. Validating a throwaway parse is
unsound: `//evil.example/public-data/x` yields an allowlisted *pathname* under a
dummy base and a foreign *host* under the real origin, returning attacker JSON
as a trusted `ApiResponse`

## Response envelope

```ts
type ApiResponse<TData = unknown> =
  | { success: true; data: TData; cacheTags?: string[] }
  | { success: false; errorMessage: string; errorCode?: string; errorParams?: … };
```

The backend must sanitize messages server-side: only deliberate business and
auth errors carry descriptive text, everything unexpected collapses to a generic
string. That is what makes `errorMessage` safe to return at all — and it is
still not UI copy. See
[`ARCH-api-response-wrapper.md`](./ARCH-api-response-wrapper.md)

## Contract hygiene

This package must not import a database client, a Redis client, or an indexer. It
describes a wire format, and a wire format that drags in a persistence layer
stops being consumable by the browser half. That is enforced as a package script
(`check:contract-hygiene`) so a stray import fails CI rather than review
