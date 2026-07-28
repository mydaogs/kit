# Monorepo

The repository contains a pnpm + Turborepo workspace under `<monorepo>/` and a separate Foundry workspace under `<contracts>/`

- Next.js web app for authenticated workflows (`<monorepo>/apps/app`)
- Next.js backend app for API/auth/cron/webhooks (`<monorepo>/apps/backend`)
- Next.js marketing or content site (`<monorepo>/apps/web`)
- Shared packages for DB access, UI, contracts, cache, and utilities (`<monorepo>/packages/*`)
- Foundry-based Solidity workspace for onchain contracts (`<contracts>/`)

For development commands and workflow rules see `rules/dev-workflow-rules.md`

## Recommended package split

Splitting shared code by concern rather than by consumer keeps dependency edges honest:

| Package | Owns |
| --- | --- |
| `@shared/db` | Prisma schema and generated client |
| `@shared/ui` | shadcn + Tailwind components, cross-app hooks/utils/types |
| `@shared/utils` | framework-free helpers, route registry, locale helpers |
| `@shared/backend-contract` | wire types, error catalog, contract version, public-path allowlist |
| `@shared/cache-tags` | the cache-tag registry, shared by producers and consumers |
| `@shared/cache-handler` | distributed Next.js cache handler + cross-app invalidation publisher |
| `@shared/kv` | shared Redis client with lazy env resolution |
| `@shared/web3-events` | event names and signatures, shared by indexer, ABI decode, and webhook filters |
| `@shared/eslint-config` | shared lint config |
| `@shared/typescript-config` | shared tsconfig presets |

A contract package must not depend on the DB package. Enforce it with a package script:

```json
"check:contract-hygiene": "! grep -rn '@shared/db' src/ 2>/dev/null"
```

## Turbo transit task pattern

The root `<monorepo>/turbo.json` uses a `transit` task as a graph node for dependency-aware hashing of `lint` and `check-types`

- `transit` intentionally has no package-level script implementation
- Turbo still creates task nodes for it (`<NONEXISTENT>` command in dry-run output) and uses them for dependency propagation (`^transit`)
- `lint` and `check-types` depend on local `transit` to get upstream invalidation without forcing serial `^lint`/`^check-types` execution

This is expected behavior and not a configuration error

## Architecture invariants as CI scripts

Encode each architectural invariant as a script under `<monorepo>/scripts/` rather than relying on review. Scripts worth carrying:

- a guard that every `cacheComponents` app registers the distributed cache handler in its `next.config`
- a guard that broad cache-invalidation primitives are not called bare, with a documented same-line `// allow:` escape hatch
- a guard against nested formatter configs shadowing the root one

The pattern matters more than the specific checks: a rule nobody can violate silently is worth more than a rule in a doc
