# [ARCH] - Event Processing Pipeline

## Description

Indexer events are processed with atomic deduplication, bounded retries, and ordering guards to ensure each log is applied once and in order

## Behavior

- Event hash uses `keccak256(txHash + logIndex + chainId)`
- A `ProcessedBlockchainEvent` ledger claims events atomically and allows retries only when `nextRetryAt` is due
- Retries use exponential backoff with a max attempt cap
- Stale `processing` rows can be reclaimed after a claim timeout so crashed handlers can resume without manual cleanup
- Handlers guard against out-of-order updates using `blockNumber` and `logIndex` watermarks
- Status updates fail fast when the block timestamp cannot be resolved so the event is retried instead of using a server-time fallback
- Block timestamp resolution uses an in-memory positive cache, in-flight request deduplication, and a short negative cache TTL to reduce repeated RPC calls during transient provider failures
- A status-transition handler validates the transition against a contract-authoritative forward map atomically inside the database transaction using the transactionally-read prior status (not a stale pre-transaction snapshot). An exact-status compare-and-set guards the write so all prior-status-dependent side effects are always consistent with the committed status, even under concurrent projection writes
- An invalid transition (missing intermediate event, processing race, stale map after a contract upgrade) throws a dedicated `StatusProjectionGapError` and is classified as `failed` with a `STATUS_GAP: <prior>→<next>` prefix and an unbounded, capped retry — it never dead-letters and is never quarantined. The cron reconciler surfaces unresolved gaps as a counter
- All state changes for one event apply in one database transaction to prevent partial-write deadlocks on replay
- A `count === 0` compare-and-set miss is classified post-transaction via a fresh read: if the event is no longer newer it is a superseded no-op; if still newer it throws a projection-gap error. Transactions read a consistent snapshot, so re-reading inside the transaction would mis-classify concurrent writes
- Decoded `eventArgs` are persisted for downstream history reads. Serialization uses the `bigIntJson` wrapper protocol — see `@mydaogs/core` → `bigint-serialization-rules.md`, including defensive coercion for plain-string rows
- Events in the `*_IGNORED_EVENT_NAMES` sets from the shared event registry decode successfully but deliberately carry no projection: the dispatcher audits them as `skipped` with decoded args preserved instead of routing them into the failed/retry path; logs whose signature is absent from the ABI entirely are likewise audited as `skipped`
- `cacheTagsToInvalidate` and the final `processed` audit state are persisted in one write after a handler succeeds, so there is no partial-state window and no second database round trip
- `cacheTagsToInvalidate` stores the replay-time cache invalidation tags so skipped replays can re-emit the same cache signals without re-running handler logic. A receipt-scoped `AsyncLocalStorage` collector deduplicates handler tag requests and publishes them once before the transaction lease finalizes; a publish failure leaves the ledger failed so the next replay re-emits the persisted manifests
- A `sourceEventHash` on generated records dedupes onchain-driven side effects across retries
- Best-effort projection-health metadata (`outcomeCode`, `entityType`, `entityId`) is written only at classified terminal/idempotent dispositions — never for plain success or in-progress retries, which are derived at read time from `status`/`nextRetryAt`. Entity fields are populated once in the dispatcher from args it already decodes; individual handlers never set them
- The atomic claim accepts an opt-in `allowTerminal` flag (replay-path only) that additionally claims a general dead letter via the same compare-and-set update the normal retry lane uses. Quarantines, orphans, anomalies, and status gaps stay unreachable through this path regardless of the flag — only the generic dead-letter class opens

## Terminal failure taxonomy

Distinguishing failure classes is what makes an indexer operable. Retrying everything hides bugs; dead-lettering everything loses recoverable work

| Class | Retry | Meaning |
| --- | --- | --- |
| retryable failure | backoff, capped attempts | transient — RPC, network, lock contention |
| `STATUS_GAP` | unbounded, capped interval | a missing intermediate event; resolvable once the gap fills |
| dead letter | none (replayable by admin) | handler bug or permanently bad input |
| quarantine | never | deterministic provenance violation — the event fails an invariant that no replay can satisfy |
| orphan | never | the event references an offchain record that no longer exists |
| anomaly | never | the event contradicts offchain state in a way that needs human classification |
| idempotent no-op | n/a | already applied; recorded for audit |

Surface these as counters in a reconciler and an admin console, with signed and audited replay restricted to the classes that are genuinely replayable

## Related files

- `<monorepo>/apps/backend/src/lib/web3/indexer/processKnownBlockchainLog.ts`
- `<monorepo>/apps/backend/src/lib/web3/indexer/processedBlockchainEventAudit.ts`
- `<monorepo>/apps/backend/src/lib/web3/indexer/eventTagManifest.ts`
- `<monorepo>/apps/backend/src/lib/web3/indexer/eventHash.ts`
- `<monorepo>/apps/backend/src/lib/web3/indexer/isNewerChainEvent.ts`
- `<monorepo>/apps/backend/src/lib/web3/indexer/statusProjectionGapError.ts`
- `<monorepo>/apps/backend/src/lib/web3/indexer/cronReconciler.ts`
- `<monorepo>/packages/web3-events/index.d.ts`
