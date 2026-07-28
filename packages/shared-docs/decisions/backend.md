# Backend Architecture

`apps/backend` is the single Next.js backend deployment. It owns auth, reads, writes, cron, webhooks, and the server cache invalidation surface. `apps/app` remains the browser-facing app and keeps only thin orchestration layers, server actions, and UI

## Key building blocks

- **Auth**: the auth library lives in `apps/backend/src/lib/auth/` and serves `/auth/*`
- **Reads**: server-only data functions live in `apps/backend/src/data/` and are exposed through `/data/*`
- **Mutations**: route handlers in `apps/backend/src/app/data/*` perform authoritative writes, validate permissions, and expire backend-local cache tags
- **Cron and webhooks**: route handlers in `apps/backend/src/app/cron/*` and `apps/backend/src/app/webhooks/*` own server-to-server work
- **Session bridge**: `apps/app` calls backend session endpoints through a thin wrapper so the browser app can keep its UI-level auth checks and server actions
- **Shared invalidation**: backend writers expire backend cache entries locally and publish invalidations targeting the browser-facing app when its deployments must refresh

## Codebase locations

- `<monorepo>/apps/backend/src/lib/auth/` (auth + RBAC + plugins)
- `<monorepo>/apps/backend/src/data/` (server-only reads and cacheable query functions)
- `<monorepo>/apps/backend/src/app/data/` (authoritative mutation handlers)
- `<monorepo>/apps/backend/src/app/cron/` (authenticated cron handlers)
- `<monorepo>/apps/backend/src/app/webhooks/` (signed webhook handlers)
- `<monorepo>/apps/app/src/actions/` (browser-orchestrated server actions)
- `<monorepo>/apps/app/src/lib/backend/client.ts` (backend HTTP client)
- `<monorepo>/packages/db/prisma/schema.prisma` (models)

## Duplicated-module gotcha

Where the browser app and the backend each keep their own copy of a content-key or link-building module, the backend copy is the source of truth for what gets written into stored records, and the app copy is what the client renders. Adding a key to one without the other is a silent bug — the client falls back to rendering the raw key string or dropping a CTA instead of erroring. Either share the module or add a check that keeps the two exhaustive maps in sync

## Public read transport and CORS

- `@shared/backend-contract` owns the allowlisted `PUBLIC_BACKEND_GET_PATHS`; all members live at `/public-data/*`, are GET-only, session-independent, and safe for shared caching
- `/public-data/*` responds with static `Access-Control-Allow-Origin: *` and has no credentialed CORS owner or `Vary: Origin`
- `/auth/*` and `/data/*` remain credentialed. Static per-origin rules set a hardcoded allowed origin, `Access-Control-Allow-Credentials: true`, and `Vary: Origin`; origins are regex-escaped for Next's `has` matcher and never echoed from a capture
- The backend proxy only handles credentialed preflights, returning 204 with `Access-Control-Max-Age: 600`; ordinary requests do not invoke it
