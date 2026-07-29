# [ARCH] - Durable Pending Transaction Registry

## Description

The `tx_sync:<hash>` browser registry preserves transaction metadata, receipt reconciliation, retry scheduling, toast recovery, and cross-tab action locks. It deliberately does not contain a render payload: all UI shows server or chain truth until reconciliation invalidates and refetches it

This is the load-bearing design decision. Storing no projected values sidesteps optimistic-UI reconciliation entirely — there is never a local value that can disagree with the chain

## Behavior

- `useAppWriteContract` queues cross-tab ownership before publishing a hash, then immediately persists a non-empty `pendingItems` tuple with entity scope, conflict key, variant, and required action key; receipt polling begins only after ownership is granted
- Entity, action, and conflict identifiers come from shared typed `TX_SYNC_ENTITY`, `TX_SYNC_ACTION`, and `TX_SYNC_CONFLICT` vocabularies, and composite conflict lookups use a shared builder so producers and consumers cannot silently drift
- The persisted shape is version 1. Hydration accepts only complete v1 per-hash entries with recognized entity, action, and conflict identifiers, and deletes any entry that fails validation
- `usePendingTxScope` is a pure selector that exposes pending IDs, visible status entries, effective account-independent conflict lookups, and required action metadata without projecting values into server data; reconnecting wallets temporarily admit every account before strict account matching resumes
- Pending and reconciling entries block a matching action across tabs and reloads; terminal warning entries remain visible for badges but intentionally do not block retries
- Exact `actionKey` matches restore the originating control's loading state after reload, while every control sharing its conflict key remains disabled
- The coordinator retains receipt polling, backend-sync retries, refetch invalidation, ownership locks, and reload-resume toast behavior
- If durable storage is unavailable after submission, the live hook and same-session watcher still track and reconcile the receipt; retry retention, cross-tab recovery, and reload recovery are disabled for that transaction
- A pending badge is only rendered on real rows or surfaces and derives its pending, retrying, or warning label from the shared translation namespace
- Write controllers remain mounted when their own action can change conditional UI, since a watcher handoff cannot carry callback closures

## Conflict key vs action key

Two separate identifiers, because they answer different questions:

- **`conflictKey`** — which controls must be disabled. Every control touching the same entity-and-operation shares one conflict key, so an in-flight write disables all of them
- **`actionKey`** — which control was the originator. Only the exact match restores its own spinner after a reload

Scope conflict keys to the operation, not the entity alone: an in-flight terms update should block the edit affordance without colliding with unrelated publish/cancel operations on the same record. Conversely, reuse an existing conflict key when two operations genuinely contend for the same onchain position, so they conflict automatically without a new key

## Variant

`variant` is the conflict and visibility policy for an item, and `selectPendingTxScope` interprets it. It is not pass-through metadata

- **`replace`** — a newer write supersedes an older one on the same entity-and-conflict key. Only the newest stays visible and only it blocks. Editing the same terms twice is one pending state, not two
- **`additive`** — independent operations that happen to share an entity. Each stays visible and each blocks on its own. Granting two roles to one account is two facts, and collapsing them would hide the first

Absent means `replace`: the conservative reading of a write that declared no policy

Precedence cannot be resolved by `timestamp` alone. Timestamp always supersedes, so an `additive` set silently renders as a single entry and the earlier grant disappears from the UI while its transaction is still in flight

Supersession is resolved twice, separately, for visibility and for blocking. A terminal warning can be the newest entry for its key and must stay visible as a badge, but it must not take the blocking slot from an older entry that is still active — the newest overall and the newest *active* are not always the same record

## Status

`selectPendingTxScope` derives `pending | retrying | warning` from `phase` plus retry bookkeeping, so a consumer never has to know that `retrying` is not a stored phase

A terminal warning stays visible but never blocks. It is a badge, not a lock: refusing to let the user retry a failed reconciliation would strand them with no way forward

## Sync contention

"The backend is already syncing this transaction" is contention, not failure. The lease is held by an indexer run that will finish, so failing on the first such response surfaces a spurious refresh warning for a transaction that is already final onchain, and leaves the projected reads stale until something else happens to invalidate them

`createBudgetedTxSync` wraps a single-shot sync in a retry budget and produces the `syncTxHash` that `reconcileConfirmedTransaction` expects. The attempt function must not retry internally — the wrapper owns that

Prefer `maxElapsedMs` over a retry count. A count is a budget in attempts, not in time: three attempts at 1.5× backoff is about four seconds, which says nothing useful about whether a lease is still held. When the elapsed budget is set it replaces count-based exhaustion, and the final delay is clamped to the remaining time so the deadline always gets one last attempt rather than being skipped past by the backoff

Only codes listed in `retryOn` are waited out. Everything else fails immediately, because retrying a deterministic rejection just burns the budget. On exhaustion the thrown error preserves `code` and `params`, so `getSyncRecoveryAction` still classifies it as retryable and the durable record survives for a later attempt

## Invalidation

`invalidateQueryKeys` attempts every key and awaits all of them before re-throwing the first failure. A sequential loop that throws on the first failure closes the reconciliation window while later refetches are still in flight — the keys after the failing one are never invalidated at all, so a confirmed transaction leaves part of the UI stale, and the retry that gets scheduled covers the whole record rather than the keys that were skipped

Keys are deduped with `stableHash` rather than `JSON.stringify`, because wallet-library query keys routinely carry bigints and stringify throws on them — which would fail dedupe before any invalidation ran, turning every confirmed transaction into a false refresh warning

## Auth pause

A 401 during reconciliation is a `pause-auth` outcome: it retains the durable record and reschedules without consuming a retry, because an expired session is not evidence the transaction cannot reconcile

`onAuthPaused` is required on `createUseAppWriteContract` rather than optional. Nothing surfaces if session authority is never refreshed — the retry simply 401s again until the budget is gone. A project with no session concept passes an explicit no-op, which is a decision rather than an omission
