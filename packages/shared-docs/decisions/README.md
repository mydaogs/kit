# Decisions Guideline

## Rules for working with decisions docs

- Most decisions are written for `<monorepo>/apps/app` unless specified otherwise
- Every time a new decision is created it must be added to the `Decisions list` below with file name and short description for easier navigation

## Decisions list (file name + one sentence short description)

1. `tech-stack.md` - chosen tech stack and why
2. `monorepo.md` - monorepo structure and the Turbo transit-task pattern
3. `frontend.md` - client-side structure
4. `backend.md` - server-side structure
5. `data-flow.md` - all onchain and offchain, client and server side data flow
6. `auth.md` - auth provider, solutions and flows
7. `backend-app-extraction.md` - standalone backend deployment, contract versioning, and deploy-ordering rules
8. `cache-handlers-shared-store.md` - cross-deployment Next.js server cache invalidation via a shared Redis store
9. `nextjs-runtime-and-cache-components.md` - Next.js/React versions, Turbopack, Cache Components, React Compiler config
10. `ppr-postponed-state-invariant.md` - the `cacheComponents` PPR postponed-state invariant on dynamic routes and its workaround
11. `database-per-environment.md` - dedicated database cluster per environment to prevent dev reseeds from orphaning onchain references
12. `solidity-upgradeability.md` - UUPS proxy deployment, initializer, and upgrade authorization model
13. `viewport-driven-read-marking.md` - receipt-based, viewport-triggered, chunked read marking for feeds and chat

## Decisions a project must add for itself

These are always required and always project-specific — write them fresh rather than porting:

- `data-models.md` - the offchain data entities
- `blockchain.md` - which contracts exist and what each owns
- `integrations.md` - third-party services chosen
- `non-goals.md` - what is explicitly not to be built
