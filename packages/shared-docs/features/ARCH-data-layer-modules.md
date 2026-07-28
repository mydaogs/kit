# [ARCH] - Data Layer Modules

## Description

Server-only data access functions live under `<monorepo>/apps/backend/src/data` in domain folders. They centralize Prisma queries and are exposed by backend route handlers when needed. The browser-facing app keeps only thin orchestrated wrappers such as session bridging and server actions

## Conventions

- Naming uses `get*ById`, `get*ByIds`, `getPending*`, `get*History`
- Modules import `server-only` to avoid client bundling
- The session domain provides backend-owned `getSession` and `requireSession` helpers; the browser app may keep a thin wrapper that forwards to the backend for orchestration
- Authorization for privileged reads is enforced at backend route boundaries using permission checkers; `src/data/*` stays focused on reusable data access and caching
- Permission checkers return `appSession` on success; reuse it at the boundary instead of calling `getSession` or `requireSession` again to avoid redundant session lookups within the same request
- Public/base and sensitive data are split into separate data-layer functions; sensitive reads use dedicated function boundaries with separate cache tags and separate client query keys
- Prisma `aggregateRaw` date fields must be typed as `unknown` and decoded with a shared server-only parse helper before date arithmetic or ISO serialization, because MongoDB returns Extended JSON rather than normal Prisma `Date` values
- A composite bootstrap endpoint that fans out several cached data functions concurrently should return independent slice envelopes, so a partial response can stay CDN-shielded briefly without failing unrelated sections

## Related files

- `<monorepo>/apps/backend/src/data/session/getSession.ts`
- `<monorepo>/apps/backend/src/data/session/requireSession.ts`
- `<monorepo>/apps/backend/src/lib/utils/parseAggregateRawDate.ts`
- `<monorepo>/apps/backend/src/app/data`
