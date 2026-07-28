# Code Units Guideline

## General purpose

Units are _react components_, _react hooks_, _utility functions_, _typescript types_ — pieces of code that should be tracked and documented

Use these docs as an index to discover what already exists before creating new code pieces

## Placement

Units can be placed in several locations and moved depending on reusability of a unit:

- Reusable across apps in the monorepo are placed in the monorepo ui package
- Reusable within an app are placed in the app's high-level shared folder
- Non-reusable are placed close to where they are being used

Exact locations are described in each unit doc markdown file. Placement rules are defined in `rules/code-organization-rules.md`

## Unit lifecycle

- Before creating a _unit_, the list of existing units should be analyzed and a decision made whether there is a suitable one, or one that requires modification to be reused
- If a new _unit_ is created, it should first be placed close to where it is being used (non-reusable) and documented in the list of non-reusable units in the dedicated file
- If a unit that suits the needs is found, it should be reused. The code location should be changed as needed — moving the unit either from non-reusable to shared, from shared within an app to shared between apps, or from non-reusable to shared between apps. Documentation should be updated accordingly

## Units docs list (file name + description)

- `./components.md` - React Components
- `./hooks.md` - React Hooks
- `./utils.md` - Utility Functions
- `./types.md` - TypeScript Types

## Dedicated unit docs

Complex units get their own file rather than a one-line inventory entry. Carried in this kit:

- `./useMarkReadOnView.md` — IntersectionObserver hook that marks items read on viewport entry with debounced, chunked, retried flushing

## Shared packages

Keep a running list of shared packages and what each owns, so consumers know where to look before adding a dependency:

- `@shared/ui` — cross-app components, hooks, types, and the semantic token contract
- `@shared/utils` — pure locale, URL, route, and type helpers with no React/UI dependency
- `@shared/backend-contract` — backend health contract, wire types, error catalog, and version constants
- `@shared/cache-tags` — canonical cache tag constants shared by producers and consumers
- `@shared/cache-handler` — distributed cache handler plus explicit cross-app invalidation publisher
- `@shared/kv` — shared Redis client with native `.mjs` runtime files
- `@shared/web3-events` — onchain event names and signatures shared by indexer, ABI decode, and webhook filters

## How the inventories work

`components.md`, `hooks.md`, `utils.md`, and `types.md` ship as **empty templates**. They are per-project inventories by nature — the value is the structure and the discipline of keeping them current, not any inherited contents. Fill them as units are created
