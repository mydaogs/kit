# React hooks

## Locations

- `<monorepo>/apps/*/src/app/**/_widgets/_hooks/` - non reusable and route scoped
- `<monorepo>/apps/*/src/lib/hooks/` - reusable within an app and re-exported via `index.ts`
- `<monorepo>/packages/ui/src/lib/hooks/` - reusable across apps and re-exported via `index.ts`

## Units files lists (file path + one sentence short description)

### Non-Reusable

<!-- route-scoped hooks under _widgets/_hooks/ -->

### Reusable within an app

<!-- hooks under apps/<app>/src/lib/hooks/ -->

### Reusable across apps

<!-- hooks under packages/ui/src/lib/hooks/ -->
