# useMarkReadOnView

Frontend hook for viewport-driven batch read-marking

## Responsibility

Observes DOM elements via `IntersectionObserver`. When an element enters the viewport, its id is added to a pending set. After a configurable debounce with no new entries, the pending set is snapshot, split into chunks of at most `maxBatchSize` ids, and each chunk is passed to `onFlush(ids)` sequentially. The hook only permanently marks a chunk's ids as flushed when its `onFlush` resolves to `true`; on failure or rejection those ids are returned to the pending set for retry on the next flush

Chunking matters: the backend rejects oversized read batches, so a single unbroken scroll past more than `maxBatchSize` unread rows would otherwise produce one over-cap request that always fails and is then retried forever. Chunking keeps every request within the server cap

Force-flush happens:

- on unmount cleanup
- on `document.visibilitychange → hidden`
- on `window.pagehide`

## Interface

```ts
interface UseMarkReadOnViewOptions {
  onFlush: (ids: string[]) => Promise<boolean>;
  enabled?: boolean;
  debounceMs?: number;
  maxBatchSize?: number;
  root?: Element | Document | null;
}

interface UseMarkReadOnViewReturn {
  registerItem: (id: string) => (el: HTMLElement | null) => void;
  flush: () => void;
}
```

## Usage

```tsx
const { registerItem } = useMarkReadOnView({
  onFlush: async (ids) => {
    const result = await markItemsRead(ids);
    if (result.success) {
      // invalidate queries
    }
    return result.success;
  },
});

// attach to list row root element
<div ref={registerItem(item.id)}>
  <RowContent />
</div>;
```

## Invariants

- `onFlush` must return a `Promise<boolean>` indicating whether the flush succeeded
- `registerItem` returns a stable per-id callback cached internally; React will not re-run cleanup+setup on every render
- Elements unmounted are automatically unobserved
- Failed flushes are re-queued and a retry timer is armed with the same debounce if no newer timer is already scheduled. Successful flushes are never re-sent
- Each flush is chunked to `maxBatchSize` ids per `onFlush` call, which must stay within the backend per-request cap. Chunks resolve independently — a failed chunk does not un-flush successful ones

## Related

- `<monorepo>/apps/app/src/lib/config/queryConfig.ts` — debounce and batch-size constants
- `decisions/viewport-driven-read-marking.md` — the read-marking model this hook implements
