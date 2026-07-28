# Code organization rules

_unit_ stands for either _React component_, _React hook_, _utility function_, or _TypeScript type_

## Rules description

These rules define where new code should live so the codebase stays discoverable and reusable code is centralized

## When to use

- Every time you add a new _unit_
- Every time you move or refactor code and need to decide whether it should be local or reusable

## When NOT to use

- If new piece of code is tightly coupled and is not expected to be reused

## Rules

- Before creating a _unit_, check `units/README.md` and the relevant units page to see if something already exists
- Prefer reusing or extending an existing _unit_ over creating a new one
- If you create a new _unit_, start by placing it close to where it is used and promote it later if it becomes reusable
- Non reusable units should be located close to their page in `<monorepo>/apps/*/src/app/**/_widgets/**` (typically in `{_components, _utils, _hooks, _types}` folder or nested deeper if needed)
- Reusable within an app units should live under the app level shared folders and be re-exported via the relevant `index.ts` barrels
- Reusable across apps units should live under `<monorepo>/packages/ui/` and be re-exported via the relevant `index.ts` barrels
- After creating or moving a unit, update the relevant file under `units/` so units stay discoverable
- Prefer `export const` rather than default exports
- All newly created _reusable_ units must be re-exported from the relevant `index.ts`
- Components with Next.js imports may live in a shared package only when that package declares Next.js as a peer dependency and the component behavior is reusable across apps; app-specific routing, configuration, and presentation remain in app-level wrappers
- For dynamic route templates (for example `"/entity/[id]"`), build URLs with `buildDynamicRoutePath` from `@shared/ui/lib/utils` instead of manual string replacement

## Barrel locations

- `<monorepo>/packages/ui/src/lib/['utils' | 'hooks' | 'types']/index.ts` - reusable *across apps* utilities, hooks, types
- `<monorepo>/packages/ui/src/components/**/index.ts` - reusable UI components (re-exported per component folder)
- `<monorepo>/apps/*/src/lib/['utils' | 'hooks' | 'types']/index.ts` - reusable *within an app* utilities, hooks, types
- `<monorepo>/apps/*/src/components/**/index.ts` - reusable app components (re-exported per component folder)
- `<monorepo>/apps/app/src/actions/index.ts` - reusable client-safe Next.js server actions

## Examples

- A type used only by `apps/app/src/app/(dashboard)/entity/[id]` should be colocated under that route's `_widgets/` (for example `_widgets/types.ts`)
- A helper function used across multiple pages in `apps/app` should go into `apps/app/src/lib/utils/` and be re-exported from `apps/app/src/lib/utils/index.ts`
- A component shared between two apps should go into `packages/ui/src/components` and be re-exported from `packages/ui/src/components/index.ts`
- For `APP_ROUTES_CONFIG[APP_ROUTES.ENTITY_PROFILE].href`, use `buildDynamicRoutePath(..., { id })` rather than `.replace("[id]", id)`
