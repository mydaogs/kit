# @mydaogs/shared-docs

Cross-cutting engineering docs for the kit: rules, architecture decisions, and patterns that belong to no single package

Docs that describe one package ship **with that package** instead — see the table below. Nothing is duplicated: every doc has exactly one home

## What this is

The engineering half of a working docs tree, extracted so a new project starts with the rules, architecture decisions, and feature blueprints already written. Only material that survives a change of product is included. Anything describing a specific domain, deploy target, or business flow stays in the originating project

## Stack assumed

- pnpm + Turborepo monorepo
- Next.js App Router with Cache Components, React Compiler, Turbopack
- Prisma + MongoDB
- TanStack Query, react-hook-form, Zod, next-intl
- wagmi + viem + Reown AppKit
- Foundry for contracts
- Upstash Redis for shared cache invalidation
- Better Auth for sessions and RBAC

Docs that depend on a stack choice say so. Drop the file if you swap that choice out

## Placeholder convention

Paths and identifiers use placeholders. Replace them once, repo-wide, when adopting

| Placeholder | Means |
| --- | --- |
| `<monorepo>/` | pnpm + Turborepo workspace root |
| `<contracts>/` | Foundry workspace root |
| `apps/app` | primary browser-facing product app |
| `apps/backend` | backend API app (auth, data, cron, webhooks) |
| `apps/web` | marketing or content site |
| `apps/cms` | headless CMS app |
| `apps/local-indexer` | local onchain poller |
| `APP_TAGS` | the project's cache-tag registry |
| `Entity` / `ENTITY` | a primary domain record and its permission entity |
| `OWNER_ROLE` / `OPERATOR_ROLE` | an organization-owner role and a delegated member role |
| `localChain` / `testnetChain` / `mainnetChain` | the three concrete chains the project targets |
| `<project>` | the project slug used in per-environment resource names |
| `<provider>` | the onchain webhook provider (`webhooks/<provider>/`) |
| `BACKEND_CONTRACT_VERSION` | the project's wire-contract version constant |

Package names (`@shared/ui`, `@shared/db`, `@shared/backend-contract`, `@shared/kv`, `@shared/cache-handler`, `@shared/utils`) are kept verbatim — they are already generic and are worth keeping stable across projects

## What lives here

- [`rules/README.md`](rules/README.md) - hard rules for working in the repo
- [`decisions/README.md`](decisions/README.md) - architecture decisions and system structure
- [`features/README.md`](features/README.md) - reusable architecture blueprints
- [`units/README.md`](units/README.md) - reusable code unit tracking (components, hooks, utils, types)

## What lives with its package

| Package | Docs it owns |
| --- | --- |
| [`@mydaogs/core`](../core/README.md) | bigint serialization rules, string shorteners |
| [`@mydaogs/contract`](../contract/README.md) | backend API contract, response wrapper, business error, server actions, backend extraction |
| [`@mydaogs/cache-handler`](../cache-handler/README.md) | distributed cache handler decision, React cache pattern |
| [`@mydaogs/query`](../query/README.md) | query integration, invalidation, error boundary, pagination rules |
| [`@mydaogs/query-client`](../query-client/README.md) | identity-scoped cache reset hook |
| [`@mydaogs/web3`](../web3/README.md) | wagmi integration, network config, env config split |
| [`@mydaogs/web3-tx`](../web3-tx/README.md) | durable pending-tx sync, pending transactions |
| [`@mydaogs/web3-client`](../web3-client/README.md) | contract write wrapper, web3 buttons |
| [`@mydaogs/indexer`](../indexer/README.md) | event processing pipeline, contract lifecycle rules, database per environment |

If a doc describes one package's behaviour, it belongs in that package. This package is for what does not fit that test

## Recommended reading order

1. [`decisions/tech-stack.md`](decisions/tech-stack.md)
2. [`decisions/monorepo.md`](decisions/monorepo.md)
3. [`decisions/backend.md`](decisions/backend.md)
4. [`decisions/frontend.md`](decisions/frontend.md)
5. [`decisions/data-flow.md`](decisions/data-flow.md)
6. [`rules/README.md`](rules/README.md)
7. [`units/README.md`](units/README.md)

## Adopting this kit

1. Copy the four folders into the new repo's `docs/`
2. Find-and-replace the placeholders from the table above
3. Delete any doc whose stack choice the project does not adopt
4. Fill the `units/` inventories — they ship as empty templates on purpose
5. Add project-specific `product/`, `runbooks/`, and domain feature docs alongside

## What is deliberately absent

- Product vision, glossary, user types, domain workflows
- Runbooks — deployment, CI, and database procedures are per-project by nature
- Diagrams — the tier structure is worth copying, the contents are not
- Legal drafts and retention matrices — these need counsel per jurisdiction and product
- `STORY-*` feature docs — user stories are the definition of project-specific
