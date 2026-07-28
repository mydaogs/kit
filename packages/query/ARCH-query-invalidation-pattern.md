# [ARCH] - Query Invalidation Pattern

## Description

Automatic client cache invalidation integrated with blockchain transactions. Ensures UI data refreshes after onchain operations by invalidating specified query keys on transaction success via the shared receipt-reconciliation helper used by `useAppWriteContract` and the transaction coordinator

## Implementation Details

**Pattern:**

```typescript
const { writeContract } = useAppWriteContract({
  onSuccess: (receipt) => {
    // Custom success logic...
  },
  queryKeysToInvalidate: [
    ENTITY_QUERY_KEY,
    SESSION_QUERY_KEY,
  ],
});
```

- `useAppWriteContract` accepts a `queryKeysToInvalidate` array prop
- A per-write `queryKeysToInvalidate` may also be passed in the second argument of `writeContract`, for keys only that call site knows about (a per-row entity, a per-item chain read). They are merged into the hook-level set for that transaction alone and land in the persisted context, so the durable reconciler still refreshes them after the calling surface unmounts
- On successful transaction receipt, invalidation runs inside a reconciliation window: the confirmation toast is shown while invalidation is in flight; dismissing the toast hides it visually but does not cancel the refetch
- The invalidation helper dedupes repeated keys before refetching, then passes `{ throwOnError: true }`, so a refetch that lands in an error state rejects the promise — success is suppressed and the refresh-warning toast fires instead, preventing success from showing over stale UI
- Supports both string keys and wagmi's `readonly unknown[]` query keys
- Refetches only active queries (`refetchType: "active"`), leaving inactive matches stale so they refresh on the next mount instead of failing the confirmed transaction path
- Backend-projected writes that need the chain hash replay step set `syncTxBeforeInvalidate: true` so the shared reconciliation helper claims the transaction before invalidation

**Manual invalidation** is used in non-blockchain contexts such as organization switching:

```typescript
await queryClient.invalidateQueries({ queryKey: [SESSION_QUERY_KEY] });
```

## Related files

- `<monorepo>/apps/app/src/lib/hooks/useAppWriteContract.ts`
- `<monorepo>/apps/app/src/lib/hooks/useTxReceiptReconciliation.ts`
- `<monorepo>/apps/app/src/lib/hooks/keys.ts`
