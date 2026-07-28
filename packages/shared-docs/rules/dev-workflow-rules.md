# Dev workflow rules

## Rule description

These rules define where to run commands and what the supported workflows are for local development, builds, linting, formatting, and database tasks

## When to use

- Any time you need to run dev, build, lint, or format commands
- Any time you need to work with Prisma (generate or push)
- Any time you need to run seeds or set up environment variables

## When NOT to use

- Smart contract development, testing, and deployment (see `decisions/solidity-upgradeability.md` and `contract-lifecycle-rules.md`)

## Rules

- Run all pnpm/turbo tasks from `<monorepo>/` (the repository root is not itself a pnpm workspace when a separate contracts workspace sits beside it)
- Use `pnpm` only (enforced via `npx only-allow pnpm`), Node version is defined in `<monorepo>/package.json`
- Prefer running scripts via `pnpm <script>` (which wraps Turbo where needed)
- Formatting
  - `turbo format` / `turbo format:fix` runs per workspace package (apps and packages)
  - `pnpm format:fix` runs the monorepo root formatter (useful for repo-level files too)
- Prisma client generation
  - Rely on Turbo task dependencies in normal workflows
  - Run `pnpm db:generate` only when `<monorepo>/packages/db/prisma/schema.prisma` changed or the Prisma client is clearly stale
- Database schema push
  - Use `pnpm db:push --filter=@shared/db` when you intentionally want to push schema changes to the database
- Seeding
  - Seed scripts live in `apps/backend/scripts/` and use the backend's Prisma client, auth schemas, and web3 helpers
  - Run the prune seed only when `NODE_ENV=test`
  - A seed that replays onchain transactions through backend routes needs the backend dev server reachable; the local onchain poller must be stopped first so it cannot race the seed
  - Env-contract foot-gun: `NEXT_CACHE_NAMESPACE`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` must match exactly between a writer app and every reader deployment it invalidates. Drift = silent no-op invalidations
- Dev servers
  - The default `pnpm dev` starts the web apps only; it intentionally does not start the local onchain poller so reseeding stays frictionless
  - Run `pnpm dev:indexer` when you explicitly need the local onchain poller for runtime sync; stop it before any seed that replays transactions
  - Run `pnpm dev:full` only when you want every dev service
  - Apps that need HTTPS locally run `next dev --experimental-https`; binding a privileged port requires elevated privileges
  - If you hit permissions issues with a privileged port, either run with `sudo` or change the port in that app's `package.json`
  - If you hit permissions issues reading certificates, check the app's `certificates/` ownership and permissions
- Environment variables
  - Full env var lists are in the relevant `.env.example` files
  - Turbo enforces required env vars per-app in `<monorepo>/apps/*/turbo.json`

## Troubleshooting

- `EACCES` on a local certificate key
  - Check file ownership and permissions under the app's `certificates/` directory
  - Either run the dev server with `sudo` or fix the file permissions locally so your user can read the key
- Privileged port binding errors
  - Either run the dev server with `sudo` or change the dev port to a non privileged port in the app's `package.json`

## Examples

```bash
cd <monorepo>
pnpm install
```

```bash
cd <monorepo>
pnpm dev
pnpm dev --filter=app
```

```bash
cd <monorepo>
pnpm build --filter=app
pnpm lint
pnpm check-types
pnpm format:fix
```

```bash
cd <monorepo>
pnpm db:generate
pnpm db:push --filter=@shared/db
```
