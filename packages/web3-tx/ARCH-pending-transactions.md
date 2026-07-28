# [ARCH] - Pending Transactions

## Description

Pending onchain transactions share the unified `tx_sync` store, so toasts, receipt watching, retry scheduling, and cross-tab action blocking survive refreshes and account switches without split-store drift

## Behavior

- `useAppWriteContract` saves pending tx metadata and action scope into the unified store once the tx hash is known, then starts receipt watching
- On receipt success, the phase is updated to `"reconciling"` and the pending toast gives way to a reconciliation toast while backend sync and query refetch run
- If backend sync or refetch fails, the pending record is **retained** (`phase: "reconciling"` plus retry metadata) so the coordinator can resume on reload without replaying the pending toast
- Retry policy is action-based: 401 pauses without consuming a retry and refreshes authoritative session state; retryable sync/refetch failures stop after a small number of outer attempts; other failures become terminal warnings while records remain persisted
- The coordinator skips hashes still owned by the live write hook, so the app never double-reconciles a fresh transaction in the same session
- `usePendingTxScope` reads the durable store as a pure selector; action surfaces use account-independent conflict-key lookups to suppress conflicting submissions and exact action keys to restore loading indicators
- Toast utilities proxy into the same unified store for metadata, phase, and toast restoration
- `createTransactionToast` uses a deterministic toast id per tx hash and visible-lifecycle generation, so live-hook → watcher handoff and pending → reconciling phase changes update in place, while a toast recreated after user dismissal or watcher cleanup gets a fresh id instead of inheriting the toast library's deleting state
- Receipt watching and reconciliation are protected by a per-hash Web Lock shared by browser tabs. The submitting hook acquires ownership before publishing the durable record; restored watchers queue without polling or showing a second toast and automatically take over if the owner closes. The same-tab fallback lock uses a FIFO waiter queue when Web Locks are unavailable
- Durable records are persisted independently as v1 `tx_sync:<hash>` entries. Mutations re-read and patch only their hash, preventing simultaneous resolutions in different tabs from clobbering or resurrecting unrelated records
- Watcher durable settlement is fenced by current lock ownership and record existence even after unmount, so completed reconciliation is not replayed. Mounted state separately fences session invalidation and success/warning toast effects
- The recovery watcher resumes eligible watchers after authoritative sign-in, restores the right toast phase, suppresses reconciling toasts for background retries, and reuses the shared reconciliation helper with delayed retry wakeups
- Restored pending toasts are rebuilt from the current locale and transaction hash instead of replaying the persisted presentation string, while caller-provided domain success messages remain available
- Replay uses active-query refetch so restored inactive queries stay stale until they mount

## Why per-hash keys

Whole-object read-modify-write cannot safely merge simultaneous completions from different browser tabs. One key per hash means each mutation touches only its own record
