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
- [`docs-readme-template.md`](docs-readme-template.md) - the `docs/README.md` entry point, since nothing upstream can write it
- `init-docs` - scaffolds the tree into an empty repository and generates the ownership record
- `check-docs-adoption` - CI check that `docs/` is at the repository root and is the only docs tree, and that the adopted tree still has an entry point, an index per folder, an ownership record, and no surviving path placeholder
- `check-docs-links` - CI check that every relative markdown link under a docs tree resolves

All three are `bin` entries, so a repo-root `package.json` calls them by name with nothing else installed

The four folder indexes list every doc the kit carries, including the ones that ship with a package. An entry marked `→ @mydaogs/<package>` is read at that package's root

## What lives with its package

| Package | Docs it owns |
| --- | --- |
| [`@mydaogs/core`](https://www.npmjs.com/package/@mydaogs/core) | bigint serialization rules |
| [`@mydaogs/contract`](https://www.npmjs.com/package/@mydaogs/contract) | backend API contract, response envelope, business errors |
| [`@mydaogs/cache-handler`](https://www.npmjs.com/package/@mydaogs/cache-handler) | distributed cache handler decision |
| [`@mydaogs/query-client`](https://www.npmjs.com/package/@mydaogs/query-client) | identity-scoped cache reset hook |
| [`@mydaogs/web3`](https://www.npmjs.com/package/@mydaogs/web3) | network config, env config split |
| [`@mydaogs/web3-tx`](https://www.npmjs.com/package/@mydaogs/web3-tx) | durable pending-tx sync, pending transactions |
| [`@mydaogs/web3-client`](https://www.npmjs.com/package/@mydaogs/web3-client) | contract write wrapper, query invalidation |
| [`@mydaogs/indexer`](https://www.npmjs.com/package/@mydaogs/indexer) | event processing pipeline |

If a doc describes one package's behaviour, it belongs in that package and is enforced there by `check:doc-ownership`. This package is for what does not fit that test: patterns a consuming app implements, which name app directories and framework conventions by necessity

## Recommended reading order

1. [`decisions/tech-stack.md`](decisions/tech-stack.md)
2. [`decisions/monorepo.md`](decisions/monorepo.md)
3. [`decisions/backend.md`](decisions/backend.md)
4. [`decisions/frontend.md`](decisions/frontend.md)
5. [`decisions/data-flow.md`](decisions/data-flow.md)
6. [`rules/README.md`](rules/README.md)
7. [`units/README.md`](units/README.md)

## Adopting this kit

From an empty repository:

```bash
git init
pnpm init
pnpm add -D @mydaogs/shared-docs
pnpm exec init-docs
```

`init-docs` scaffolds the whole tree: the four folders, the `docs/README.md`
entry point, `product/` and `runbooks/` stubs, the four project-authored
decision stubs, the two `check:docs*` scripts, and — the part worth automating —
the **ownership record** in each carried folder, generated from the files it
actually copied at the version actually installed

It refuses to run anywhere but a repository root, because `docs/` inside a
workspace is the one mistake no later check can recover. It is idempotent:
a re-run fills what is missing and reports what it left alone

What it cannot do is decide the project's own content:

1. Replace the placeholders from the table above, repo-wide
2. Delete any doc whose stack choice the project does not adopt, and its index entry
3. Fill the `units/` inventories — they ship as empty templates on purpose
4. Answer the four `decisions/` stubs
5. Run `pnpm check:docs`, which enumerates exactly what is still outstanding

Then wire both checks into CI, triggered on `docs/**` — see
[`rules/docs-rules.md`](rules/docs-rules.md#enforcement)

The generated ownership record is what keeps the copy honest. Once the
placeholders are replaced a copied doc reads as the project's own, and nothing
tells a reader that a fuller version exists upstream, or that a fix belongs
upstream rather than locally. It goes in the folder `README.md` rather than as a
banner on each file — that is where readers are told to start, and a per-file
banner restates the same fact once per file and goes stale one file at a time

## What is deliberately absent

- Product vision, glossary, user types, domain workflows
- Runbooks — deployment, CI, and database procedures are per-project by nature
- Diagrams — the tier structure is worth copying, the contents are not
- Legal drafts and retention matrices — these need counsel per jurisdiction and product
- `STORY-*` feature docs — user stories are the definition of project-specific
