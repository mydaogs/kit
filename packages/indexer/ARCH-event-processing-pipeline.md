# Event processing pipeline

## Description

Primitives for applying an onchain log exactly once, in order, with a failure
taxonomy that stays operable. The package is storage-agnostic: it defines the
`EventLedger` interface and the decision logic, and the host supplies the
database

## Identity and ordering

- `computeEventHash` derives an event's identity from `keccak256(txHash +
  logIndex + chainId)`. The chain id is part of it deliberately — the same
  transaction hash on two chains is two different events
- `isNewerChainEvent` compares `(blockNumber, logIndex)` watermarks so a
  re-delivered or out-of-order log cannot overwrite a newer projection

## The claim contract

`EventLedger` requires an **atomic** claim: a compare-and-set that takes an
event from unclaimed to processing in one operation. Retries become eligible
only when `nextRetryAt` is due, and a stale `processing` row must be reclaimable
after a timeout so a crashed handler resumes without manual cleanup

`createEventProcessor` drives that contract. A `ClaimResult` reports whether
this caller owns the event; `ProcessorContext` carries what a handler needs;
`ProcessResult` reports the disposition

Apply all state changes for one event in a single transaction. Partial writes on
a replay path are how deadlocks and half-projected entities happen

## Backoff

`computeRetryAt` implements exponential backoff with a cap, for transient
failures. `computeStatusGapRetryAt` is separate and deliberately different — see
below

## Failure taxonomy

Distinguishing failure classes is what makes an indexer operable. Retrying
everything hides bugs; dead-lettering everything loses recoverable work.
`classifyProjectionFailure` maps a thrown error to `PROJECTION_OUTCOME`, and
`ClassifiedFailure` / `ProjectionHealthClass` carry the result

| Class | Retry | Meaning |
| --- | --- | --- |
| retryable | backoff, capped attempts | transient — RPC, network, lock contention |
| status gap | unbounded, capped interval | a missing intermediate event; resolves when it lands |
| dead letter | none, replayable | handler bug or permanently bad input |
| quarantine | never | deterministic provenance violation no replay can satisfy |
| orphan | one retry | references an offchain record that is not there |
| anomaly | never | contradicts offchain state; needs human classification |
| idempotent no-op | n/a | already applied; recorded for audit |

Two of these are load-bearing and easy to get wrong:

- **Status gaps never dead-letter.** `StatusProjectionGapError` means an
  intermediate event has not arrived yet. It resolves on its own once the gap
  fills, so an attempt cap would strand recoverable work. It retries unboundedly
  at a capped interval instead
- **`OrphanedProjectionError` gets exactly one retry.** Its dominant cause is a
  webhook arriving before the offchain row commits, which self-heals within a
  backoff cycle. A genuinely missing referent still terminates on the second
  attempt

`QuarantineProjectionError` and `ProjectionAnomalyError` are terminal by
construction — they describe states that no replay can fix, so making them
retryable only burns attempts

## Status transitions

Validate a transition against a forward map **inside** the transaction, using
the transactionally-read prior status rather than a pre-transaction snapshot,
and guard the write with an exact-status compare-and-set. Otherwise
prior-status-dependent side effects can disagree with the committed status under
concurrent writes

Classify a compare-and-set miss (`count === 0`) *after* the transaction, via a
fresh read: if the event is no longer newer it was a superseded no-op; if it is
still newer, it is a projection gap. Re-reading inside the transaction
mis-classifies concurrent writes, because the transaction sees a consistent
snapshot

## Persisted args

Decoded event args must round-trip through the tagged bigint protocol in
[`@mydaogs/core`](https://www.npmjs.com/package/@mydaogs/core) — chain args are
full of bigints and native `JSON.stringify` throws on them. Coerce defensively
on read: a persisted row may carry a plain decimal string, and a strict
`typeof === "bigint"` check would silently drop it

## What the host owns

The ledger implementation, the ABI and which events are deliberately ignored,
the concrete projections, and any reconciler or admin replay console. This
package supplies identity, ordering, claim semantics, backoff, and
classification — the parts that are the same in every indexer and wrong in
subtly different ways each time they are rewritten
