# Viewport-driven, debounced/batched read marking

## Context

A newest-first feed needs a read signal that can express "saw the top one but not the two below it". Monotonic cutoffs — a per-audience watermark or a `lastReadAt` timestamp cursor advanced to `now` on open — cannot express that, and mark unseen items as read whenever a surface is opened

## Decision

Read marking is **viewport-driven and receipt-based** on both notification feeds and chat surfaces

1. **Notifications** → receipt-only per-item read
   - A nullable `readAt` on a per-user receipt row is the single read signal for all audiences
   - Unread predicate: `receipts: { none: { userId, readAt: { not: null, isSet: true } } }`. The `isSet: true` is required: receipts are created without a `readAt` (absent, not stored `null`), and Prisma's MongoDB `{ not: null }` matches absent fields, so without it an unread receipt counts as read (badge `0` while the row renders unread). See `rules/prisma-mongodb-rules.md`

2. **Chat** → receipt-only per-item read
   - A read-receipt row keyed by (messageId, readerType, readerId, readAt)
   - A message is unread for a reader if no receipt exists for that reader scope
   - A reader's own authored message is exempted from their unread count by an immutable author receipt written at message-creation time, not by a viewport or sender-identity check — so **all** message rows are registered for observation

3. **Trigger** = any viewport entry (no dwell timer). An item counts as seen the moment any part enters the viewport

4. **Flush** = short debounce (750 ms) + flush-on-close. Seen ids accumulate and flush after 750 ms of no new ids; force-flush on unmount and on `visibilitychange → hidden` / `pagehide`

5. **UI updates after server success**. Read styling and unread badges update only after the mark request succeeds (via query invalidation). There is no optimistic local read state

## Author receipts and materialized counters

Exemption is a **durable author receipt, not a re-derived heuristic**. The single sanctioned message-create path writes an immutable read receipt for the author's reader identity in the same transaction as the message. Ownership must not be inferred from mutable sender/member state, because that can disagree with what was actually exempted at creation — for example an admin who authored under a personal identity then views the same room as an organization member. Receipts are the correctness source of truth

Unread reads are served from a materialized per-conversation × reader-identity counter, maintained by the create path (increment fan-out) and the mark-read path (decrement), with a receipts `groupBy` retained as the recompute/repair ground truth

## Backend

- A mark-read route accepts an explicit id array and validates access
- Every read route caps a single request at 100 ids
- The mark-read service runs **no** own-message/sender filter — an own-authored message already carries its author receipt, so the service's existing-receipt check naturally skips it and never decrements a counter for it
- Derive `readAt` on the read model only for the inbox view; other views always return `readAt: null`
- The viewport mechanism is the only path that marks items read; there is no mark-all route or action

## Frontend

- `useMarkReadOnView` — shared `IntersectionObserver` hook with debounced flush and force-flush on teardown. `onFlush` returns `Promise<boolean>`; ids are marked permanently flushed only on success, and failed batches retry on the next flush. Per-id ref callbacks are cached so React does not re-observe elements on every render. Each flush splits into server-sized chunks sent sequentially, so a long unbroken scroll past more than the cap cannot produce an over-cap request that the backend rejects and the hook then retries forever
- Notification lists register unread rows; there is no on-mount mark-all
- Chat message lists register **all** message rows and send seen ids in chunks; the backend creates a receipt for each id that does not already have one

## Consequences

- Fast scroll-past still marks items as read (accepted trade-off for simplicity)
- Fire-and-forget flush + force-flush on `pagehide` may drop the very last batch if the tab is killed before the request leaves; acceptable, since the next open re-marks

## Related files

- `<monorepo>/apps/app/src/lib/hooks/useMarkReadOnView.ts`
- `<monorepo>/apps/backend/src/data/chats/markConversationMessagesRead.ts`
- `<monorepo>/apps/backend/src/data/chats/createConversationMessageTx.ts`
