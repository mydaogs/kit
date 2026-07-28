# Backend App Extraction

## Context

A browser-facing app that ships in several deployments (locales, regions) would duplicate the same backend logic across all of them and force every mutation change to redeploy every one. That responsibility belongs in a single `apps/backend` deployment

## Decision

- `apps/backend` is the authoritative owner of auth, server data reads, data writes, cron, and webhooks
- `apps/app` remains the browser-facing app and keeps UI, server actions, and local cache invalidation orchestration
- The backend contract is intentionally tiny and versioned via `@shared/backend-contract`
- `apps/app` reads browser-visible data directly from the backend and forwards user writes through backend HTTP calls from server actions
- Actor-scoped backend reads derive sensitive organization scope from the authenticated session rather than trusting a browser-supplied organization id
- Backend writers expire backend-local cache entries with `revalidateTag(..., { expire: 0 })`; server actions call `updateTag()` locally for read-your-own-writes

## Deploy ordering

- When `BACKEND_CONTRACT_VERSION` changes, the backend must deploy before any consumer deployment
- A consumer build should fail fast if the backend health probe or contract version check does not match the expected version
- Every consumer deployment and the backend MUST share identical `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `NEXT_CACHE_NAMESPACE`. Cross-deployment cache invalidation silently breaks if any one drifts
- CI enforces contract hygiene with a dedicated workflow
- Deploy ordering is enforced at runtime by a gate workflow that polls backend `/health` and fans out consumer deploy hooks only after `contractVersion` matches

## Consequences

- The backend is deployed once instead of once per consumer
- The browser app can keep deployment-specific rendering while still using a single backend source of truth
- Cache invalidation stays O(1) per deployment and still fans out across all readers through the shared cache handler

## Related files

- `<monorepo>/apps/backend`
- `<monorepo>/apps/app/src/lib/backend/client.ts`
- `<monorepo>/packages/backend-contract/src/index.ts`
- `data-flow.md`
