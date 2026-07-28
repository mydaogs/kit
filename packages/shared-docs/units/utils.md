# Utility functions

## Locations

- `<monorepo>/apps/*/src/app/**/_widgets/_utils/` - non reusable and route scoped
- `<monorepo>/apps/*/src/lib/utils/` - reusable within an app (shared) and re-exported via `index.ts`
- `<monorepo>/apps/*/src/lib/schemas/` - reusable app-level schema and canonicalization helpers
- `<monorepo>/apps/*/src/lib/utils/client.ts` - client-only barrel re-exports for utility helpers
- `<monorepo>/apps/*/src/lib/utils/server.ts` - server-only barrel re-exports for utility helpers
- `<monorepo>/apps/backend/src/lib/web3/indexer/` - server-only blockchain indexer handlers
- `<monorepo>/packages/ui/src/lib/utils/` - reusable across apps and re-exported via `index.ts`
- `<monorepo>/packages/utils/src/` - reusable pure helpers shared across apps and re-exported via `index.ts`

## Units files lists (file path + one sentence short description)

### Non-Reusable

<!-- route-scoped utils under _widgets/_utils/ -->

### Reusable within an app

<!-- utils under apps/<app>/src/lib/utils/ -->

### Reusable across apps

<!-- utils under packages/ui/src/lib/utils/ and packages/utils/src/ -->
