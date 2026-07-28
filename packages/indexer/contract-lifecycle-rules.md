# Contract lifecycle rules

## Rule description

These rules define how onchain deploys and upgrades must be coupled with database prunes, indexer webhook regeneration, and the indexer cold-start floor

They assume the pattern where onchain record IDs are offchain database IDs: a record is created offchain as a draft, then published onchain under that ID. The log processor decodes the ID and resolves it with a `findUnique` behind a validity check. Chain state therefore holds references into the database, which is what couples the two lifecycles

## When to use

- Any time contracts are deployed or upgraded on any network
- Any time the database is pruned or indexer cursors are reset
- Any time a Solidity event signature is added, removed, or changed

## Rules

### Prune and deploy move together

- Pruning the database requires a fresh deploy. Deploying fresh requires a prune. They are one operation, not two
- Never prune while keeping a proxy alive. The contract retains records keyed by IDs that no longer exist, so every later event for them hits the orphan path and can never project. The referent is gone permanently — no replay or reconciliation recovers it. Live onchain flows also remain that the app cannot render
- Never upgrade a proxy whose records have been pruned. This is the same failure reached from the other direction
- A long-lived proxy also pins the reconciler's cold-start floor to the original deploy block, so each later prune re-scans a growing history into a database whose rows were just deleted

### Choosing deploy vs upgrade

- While data is disposable (prunes are still happening), use a full-deployment script + prune. Chain and database start empty together and are consistent by construction
- Once there is state worth preserving, stop pruning and switch to the upgrade script. That switch is the same boundary — adopt upgrades at the moment prunes stop, not before
- Do not adopt upgrades early to avoid webhook address edits. Upgrades enforce storage-layout compatibility, which fights active struct churn, and the only escape hatch is `unsafeSkipStorageCheck` — never use it

### Indexer webhook regeneration

- The webhook's addresses and `topic0` list live in the provider dashboard, not in env. No deploy, upgrade, or env propagation step updates them
- The provider matches `address ∈ addresses AND topic0 ∈ topics[0]`. Drift in either half is silent: no error, no failed rows, no alert. Only the reconciler cron keeps projections moving, so an outage reads as latency rather than breakage
- Regenerate after any **fresh deploy** (addresses change) and after any **event signature change** (`topic0` changes), including upgrades. A stable proxy address does not protect topics — `topic0` is a hash of the signature
- Never hand-edit the query. Generate it with a script that derives addresses from the target backend's `/health` and topics from the shared event registry
- Regenerate only after the backend redeploy has landed — `/health` is the address source and must already report the new values
- Deliberately ignored events carry no projection and must stay out of the query. The TRIGGER lists, not the full ABI, are the source of truth
- If a webhook is created rather than edited, update the signing key or every delivery is rejected

### Indexer cold-start floor

- `NEXT_PUBLIC_DEPLOYMENT_BLOCK` is the cron reconciler's cold-start floor only. The webhook handler has no block floor, and the local indexer tracks its own `lastSyncedBlock`
- The floor is inert while a sync-checkpoint row exists. It becomes load-bearing exactly when the checkpoint is absent: first deploy, an explicit cursor reset, or a prune (the checkpoint is in the prune list)
- Take the floor from the new deployment manifest's `deploymentBlock`. Never set it from the chain head or a pre-computed guess, and move it if the deploy slips
- Setting the floor above the real deploy block skips every event in between permanently, and a pruned database leaves no prior state to notice the loss against. Setting it below is safe — only wasted no-op scans

## When NOT to use

- Local development against a disposable chain is exempt from the prune/deploy coupling: the local node restarts from genesis, so chain and database reset together by default, and the reconciler resolves its floor to `0n` for the local chain id regardless of the env value
- Rolling back a bad implementation through the upgrade script is not a redeploy. The proxy address and storage are unchanged, so no prune, no env propagation, and no webhook address change. Regenerate the webhook only if the rollback moved an event signature

## Examples

### Wrong — prune while keeping the proxy

```bash
# Proxy stays live, database wiped
pnpm --filter backend seed:prune
# Onchain records now reference IDs that no longer exist.
# Every later event for them orphans forever.
```

### Wrong — regenerating the webhook before the backend knows the new addresses

```bash
forge script script/deployments/FullDeployment.s.sol ... --broadcast
pnpm --filter backend webhook:print-query --from https://api.example.com/health
# /health still reports the OLD addresses — this pastes the outgoing proxies
```

### Right — fresh deploy, propagate, prune, regenerate

```bash
# 1. Deploy; read addresses + deploymentBlock from the deployment manifest
forge script script/deployments/FullDeployment.s.sol ... --broadcast

# 2. Propagate env (contract addresses + NEXT_PUBLIC_DEPLOYMENT_BLOCK = actual
#    deploy block, not the chain head), then redeploy backend

# 3. Confirm the backend reports the new values
curl -s https://api.example.com/health

# 4. Prune (chain and database reset together)
pnpm --filter backend seed:prune

# 5. Regenerate the webhook and paste into the provider dashboard
pnpm --filter backend webhook:print-query --from https://api.example.com/health

# 6. Reseed admins — prune wipes User/Organization/Member
pnpm --filter backend seed:admins
```

### Right — upgrade with an event signature change

```bash
# Proxy address unchanged: no env propagation, no prune.
# topic0 moved, so the webhook still needs regenerating.
forge script script/deployments/UpgradeProxy.s.sol:UpgradeProxy ... --broadcast
pnpm --filter backend webhook:print-query --from https://api.example.com/health
```

## Related

- `dev-phase-state-rules.md` — why offchain shape changes bump a version instead of migrating, given the prune this file governs
- `@mydaogs/indexer` → `ARCH-event-processing-pipeline.md` — how projected events are claimed, retried, and classified
