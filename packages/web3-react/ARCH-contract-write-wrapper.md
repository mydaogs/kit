# [ARCH] - Contract Write Wrapper

## Description

`useAppWriteContract` wraps wagmi writes with hash-time submission callbacks, receipt polling, toast lifecycle, unified tx-sync persistence, and optional query invalidation. It accepts per-write pending scope metadata and returns a `Promise<Hash | null>` without requiring a separate transaction registry write

## Behavior

- Acquires cross-tab ownership for the hash, then persists the pending tx record plus its action-scope metadata in its `tx_sync:<hash>` entry once wagmi exposes the tx hash
- If the hook has already unmounted when the wallet prompt resolves, the tx is still persisted but live ownership and toast ownership stay with the coordinator instead of the dead component
- Fires `onTransactionSubmitted({ hash })` after the durable entry is saved
- Polls receipts with bounded retries and backoff
- `isProcessing` stays continuously `true` via `isTxPending || Boolean(hash)` — `hash` is cleared only by `resetWriteContract()` at terminal cleanup, so there is no flicker between receipt landing and reconciliation completing
- On receipt success, enters **reconciliation** phase: updates the stored record to `phase: "reconciling"` and updates the persistent hash-keyed toast in place to a "confirmed, updating data" message (dismissible — visual only, does not cancel sync)
- Receipt polling only starts after the live hook owns the per-hash Web Lock; ownership is retained through reconciliation and released at terminal cleanup, so another browser tab cannot run the same callback/sync lifecycle concurrently
- After backend sync and query refetch settle, dismisses the reconciliation toast, shows the success toast (`successMessage` if provided, else the generic localized string), and clears the pending record unless a retryable reconciliation failure requires retention
- Pass `syncTxBeforeInvalidate: true` to replay the tx hash into the backend before invalidating queries, with an elapsed-time retry budget; if the backend or refetch path fails, the warning toast fires and the pending record is retained for background retry and cross-reload recovery
- Reconciliation invalidation dedupes query keys and refetches only active matches, so inactive queries stay stale until mount instead of turning a confirmed tx into a false warning
- All generic pending, reconciliation, success, warning, reverted, submission-error, receipt-error, and unexpected-error copy lives under one translation namespace
- For reconciliation failures, the warning toast fires, the success toast is suppressed, and the pending record is retained for retry scheduling; retryability controls exhaustion: non-retryable sync failures settle into a terminal warning state, while retryable sync failures and refetch failures keep retrying so transient outages can recover
- Every write must call `writeContract(params, { pendingItems })` with at least one scope item. Every item requires an `actionKey`; missing or empty scope metadata is rejected by TypeScript and malformed persisted entries are discarded during hydration
- `onSuccess(receipt, result)` means the onchain receipt succeeded. It fires after the reconciliation attempt even when sync or refetch reports a warning, because refresh failure does not reverse chain finality. The second argument exposes the reconciliation result so callers can preserve their own success/failure UX. Use `onTxSynced` when behavior must require successful backend sync instead
- Callback functions are live-owner-only and cannot survive a handoff to the recovery watcher; write hooks that own required navigation or other callback behavior must be mounted above any UI branch that can initiate the write

## Decoded revert names

Pass `errorNameOverrides: Record<string, string>` to map specific Solidity custom error names to friendly copy. A simulation or receipt error is decoded to its error name and, when it matches, the override is shown in place of the generic submission/revert message

## successMessage prop

Pass `successMessage: string` to show a domain-specific toast on confirmation instead of the generic fallback. The value is persisted with the pending transaction metadata so the recovery watcher can show it after a page refresh without the originating hook being mounted. Do not also call `toast(...)` inside `onSuccess` — that would produce a double toast

## syncTxBeforeInvalidate and onTxSynced props

Pass `syncTxBeforeInvalidate: true` on any write that touches backend-projected data (indexer-sourced queries). The wrapper replays the tx hash into the backend with an elapsed-time retry budget (capped exponential backoff, final attempt guaranteed at the deadline) before invalidating client queries. If the backend or refetch path fails, the caller dismisses the reconciliation toast, shows the refresh warning, suppresses success, and **retains** the pending record. A 401 pauses it and refreshes session authority without consuming a retry; retryable sync/refetch failures cap at a small number of outer attempts; other failures become terminal warnings. Only `syncTxBeforeInvalidate` is persisted; after a page refresh the recovery watcher runs sync and invalidation from the durable pending record

## Related files

- `<monorepo>/apps/app/src/lib/hooks/useAppWriteContract.ts`
- `<monorepo>/apps/app/src/lib/hooks/useTxReceiptReconciliation.ts`
- `<monorepo>/apps/app/src/lib/utils/pendingTransactionToast.ts`
- `<monorepo>/apps/app/src/lib/errors/contractErrorMessages.ts`
- `<monorepo>/apps/app/src/lib/web3/getExplorerTxUrl.ts`
