# Data flow

## Browser reads

1. A route-local or shared React hook issues a query
2. `apps/app` resolves the request to the backend directly via `NEXT_PUBLIC_BACKEND_API_ORIGIN`
3. Credentialed reads use `backendFetch` with `credentials: "include"`. Audited anonymous reads use the typed `publicBackendFetch` lane instead: GET-only `/public-data/*` requests omit credentials and reject bodies, credential overrides, and non-CORS-safelisted headers so they never preflight
4. The backend route handler extracts runtime context, calls a server-only data function in `apps/backend/src/data`, and returns a typed JSON envelope
5. The data function uses `"use cache"`, `cacheTag()`, and `cacheLife()` to keep repeated reads fast across requests

### Choosing the `/public-data/*` lane

A read belongs on the credential-free lane only when its payload is identical for every viewer. If the response varies by who is asking, it belongs on `/data/*` behind a session

Static reference dictionaries are the clearest case: a cities-by-country endpoint returns data from an in-memory map, with no session, no database, and nothing per-viewer to redact. It carries no `"use cache"` — there is no query to memoize — and relies purely on its CDN headers. Every `/public-data/*` base path must also be listed in `PUBLIC_BACKEND_GET_PATHS` (`packages/backend-contract`), which is what makes it reachable through `publicBackendFetch`

A viewer-scoped read stays on the session lane even when a public variant looks tempting. A "my organization" filter is a `scope=all|mine` parameter with the organization derived from the session, never a client-supplied organization id

Where a cached data function must serve several viewer classes, keep the cached layer viewer-agnostic and redact per viewer in the route handler after the fetch. Redaction returns an already-narrowed union so a restricted client never receives the hidden fields:

```ts
export type RedactableOrganizationIdentity =
  | { visibility: "hidden" }
  | {
      visibility: "public";
      id: string;
      name: string | null;
      slug: string | null;
      logo: string | null;
    };
```

The `hidden` branch carries no identifying metadata — not even the id — so a restricted viewer never receives it, and TypeScript forces every consumer to handle the check. This is strictly better than nulling individual fields

## User writes

1. A server action in `apps/app` validates UI intent and performs the local auth/role gate
2. The action forwards the mutation to `apps/backend` over HTTP through the server-only backend fetch wrapper, which forwards the incoming cookie header
3. The backend re-authenticates, validates permissions again, writes the DB, and expires its own cache entries with `revalidateTag(tag, { expire: 0 })`
4. Backend write responses may include `cacheTags`; the server-only backend fetch wrapper applies those tags locally with `updateTag()` so the originating deployment refreshes immediately. When a backend route delegates part of its invalidation to a helper, that helper must return the concrete tags so the route can surface them in `cacheTags`
5. Client-side TanStack Query caches refresh on their normal refetch triggers after the server response returns

Slug rotation is a recurring special case of this flow: the backend must treat the current `slug` as canonical while also preserving a historical `slugs` array, and every write path must invalidate the previous canonical slug, the new canonical slug, and any released/claimed historical slugs so public profile caches can rewrite old URLs to the current canonical one without serving stale negatives

Terminal lifecycle transitions also use guarded predicates on the captured slug and lifecycle state, so approve/cancel/reject races fail closed instead of persisting history from a stale read

## Backend server-to-server writers

- Cron jobs and signed webhooks live in `apps/backend/src/app/cron/*` and `apps/backend/src/app/webhooks/*`
- Onchain indexer processors live in `apps/backend/src/lib/web3/indexer/*`
- These handlers expire backend-local cache entries with `revalidateTag(tag, { expire: 0 })`
- When the write affects browser-visible deployments, they also publish `publishCacheInvalidation({ kvClient: kv, targetAppName: "app", tags, mode: "expire" })`. The caller passes its own `kv` from `@shared/kv/rest` — cache-handler has no runtime dep on `@shared/kv`
- CORS is only for browser-facing routes (`/auth/*`, `/data/*`, `/public-data/*`); it is not an auth boundary and does not apply to cron or webhooks
- The backend `/health` endpoint returns `503` with a valid JSON body when the database is degraded; the consumer's build-time contract probe reads the body first and tolerates this degraded state when `contractVersion` matches

## When to use which invalidation primitive

- **Inside `/data/*` POST routes** — use `revalidateTag(APP_TAGS.X, { expire: 0 })` for the backend's own cache, and include the same tag in the `cacheTags` response envelope. The server action calls `updateTag()` on receipt; that writes the bump into the shared app Redis namespace and every peer deployment picks it up via `refreshTags()` polling
- **Backend-only writers** (cron, webhooks, indexer, auth hooks, anywhere outside `/data/*` routes) — use `await invalidateAppTags([APP_TAGS.X])`. This does the backend-side `revalidateTag` plus `publishCacheInvalidation({ targetAppName: "app" })` so peer deployments observe the bump
- **Shared data helpers** invoked from both contexts — return the affected tags and let the caller choose the primitive. Do not call `revalidateTag` or `invalidateAppTags` inside the helper

A helper that returns tags must also leave the _timing_ to its caller: a worker flushes only after its own final status write has landed, otherwise a concurrent reader can repopulate the cache from the pre-transition row

Enforce the bare-call ban with a CI script

### Which tags may appear in the HTTP `cacheTags` envelope

The response envelope is visible to the caller, so it may only carry tags the caller is already entitled to know about:

- **Envelope + `revalidateTag(tag, { expire: 0 })`** — tags scoped to the caller themselves, and constant aggregates that encode no identity
- **`invalidateAppTags` server-side only** — any tag parameterized by _another_ principal's id. These must never reach the envelope; flush them internally with a same-line allow comment:

  ```ts
  await invalidateAppTags([...]); // allow:invalidateAppTags — user-specific tag must not leak in the public HTTP response envelope
  ```

  The comment must be on the same line as the call — that is what the lint gate matches

When a helper returns one flat tag list spanning both tiers, the **route** partitions it: only the route knows the actor context. Dedupe with a `Set` before publishing either tier

## Shared cache invalidation

- `revalidateTag()` is the backend-local invalidation primitive
- `updateTag()` is applied by the app's server-side backend wrapper when backend responses carry `cacheTags`
- `publishCacheInvalidation()` is the explicit cross-app fanout primitive when backend-originated writes need to invalidate a peer app
- Each app uses a different `appName` in its cache handler, but all share the same `NEXT_CACHE_NAMESPACE` and Redis credentials
- Peer deployments of the same app must all keep the same `NEXT_CACHE_NAMESPACE`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` so cross-deployment invalidation works

## Session read staleness policy

- The client-side default for the session read is stale-allowed: the query function omits the `allowStale` param, and the backend treats any value other than the literal string `"false"` — including absent — as `allowStale: true`
- This is safe by construction, not by omission: the backend KV session cache is invalidated on every identity-relevant mutation, so a stale-allowed read only ever serves a cache entry that has not yet been invalidated by a write that already ran its own invalidation, never one that missed it
- `allowStale=false` (a genuinely fresh, non-cached read) is still warranted for: post-restore/initial-mount reconciliation, any read taken immediately after an identity mutation the caller itself just performed, and any permission-critical read where acting on a cached-but-technically-still-valid session is not an acceptable risk

## Rules

- Prefer client-side reads over SSR for revisitable authenticated flows where TanStack Query can eliminate repeated server hits
- Prefer direct backend reads from app hooks instead of proxying through app API routes
- Keep session extraction at the boundary that owns the write or read
- Use `revalidateTag(..., { expire: 0 })` from backend route handlers, cron, and webhooks
- Backend write handlers accept the raw JSON payload sent through the `backendFetch` wrapper
