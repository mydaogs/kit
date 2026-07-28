# Database per Environment

## Context

Three runtime environments exist: local, testnet, and mainnet. Sharing one database cluster across them breaks in two converging ways:

1. Onchain events store offchain record IDs in indexed `bytes32` fields. A local dev prune/reseed regenerates every ID, silently orphaning those immutable onchain references — the projection handler throws, the reconciler records the event as failed, and the scheduled job stays permanently red
2. Projection tables are not chain-scoped while the sync cursor is, so a shared DB mixes records from all chains

## Decision

Each environment owns a dedicated, isolated database cluster or project. Cluster names are **strictly enforced** by the env guard at backend startup

| Environment | Chain | `NEXT_PUBLIC_NETWORK` | `NODE_ENV` | Target cluster (name must contain) |
|---|---|---|---|---|
| Local | local node | *(any)* | `development` | `local-<project>` |
| Testnet | testnet | `testnet` | `test` / `production` | `testnet-<project>` |
| Mainnet | mainnet | `mainnet` | `production` | `mainnet-<project>` |

`DATABASE_URL` must be set to the cluster that corresponds to the runtime environment, and its hostname or path must contain the required cluster name identifier. The backend's `getEnvConfigServer()` validates `DATABASE_URL` at startup. Any additional app with its own database URL validates it before booting or running seed/prune commands. Both guards check only the parsed hostname and path, not credentials or query params

A cron reconciler that talks to the backend over HTTP never connects to the database directly, so no scheduler secret changes are required for this separation

## Operational runbook

After provisioning each new cluster:

1. Set `DATABASE_URL` in the environment's hosting project (or local `.env`) to the new cluster's connection string
2. Run `pnpm db:push --filter=@shared/db` from the monorepo root to apply the Prisma schema
3. Run the index-setup script to create any partial unique indexes Prisma cannot express
4. Run seed scripts as needed

To reset an environment's indexer state (e.g. after a DB reseed orphaned onchain references):

```bash
# Delete failed events; cron retries any with nextRetryAt still set automatically
pnpm --filter backend db:reset-indexer --yes

# Also reset the cursor — required for permanently-stuck events (nextRetryAt = null).
# The atomic claim skips surviving failed rows (retry-due needs nextRetryAt set), so
# recovery requires both: --yes deletes the failed row, --reset-cursor brings its block
# back into scan range so the event can be claimed fresh on the next reconcile pass.
pnpm --filter backend db:reset-indexer --yes --reset-cursor

# Full replay: reset cursor + delete all events (safe — handlers are idempotent)
pnpm --filter backend db:reset-indexer --yes --all

# Restrict any of the above to one chain
pnpm --filter backend db:reset-indexer --yes --reset-cursor --chain=<chainId>
```

## Related

- `@mydaogs/indexer` → `contract-lifecycle-rules.md` — why a prune and a fresh deploy are one operation
- `@mydaogs/indexer` → `ARCH-event-processing-pipeline.md` — claim, retry, and orphan-skip behavior
