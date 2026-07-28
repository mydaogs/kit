# Pagination Rules

## Rules

- Use cursor-based pagination for all growing list endpoints
- Return paginated list payloads as `{ items, nextCursor }`
- Use deterministic ordering with a stable tie-breaker (`id`)
- For forward infinite feeds, request `limit + 1` rows in data functions, trim to `limit`, and derive `nextCursor` from the last returned item
- Use lazy infinite loading with `IntersectionObserver` and a manual fallback button for feeds and grids
- Use the shared `useInfiniteScroll` hook for feed/grid infinite behavior
- Keep reverse-chronological chat pagination explicit via manual `Load older messages` controls
- Keep admin moderation tables on offset/page pagination for auditable page/total navigation

## When To Use Infinite Scroll

- User-facing feeds and card grids where volume can grow substantially
- Default observer `rootMargin` should be `240px`
- Always include manual fallback when auto-load is disabled
- Always include an explicit action to re-enable auto-load after failures

## When Not To Use Infinite Scroll

- Reverse chronological chat logs where users intentionally request older messages
- Admin tables that require explicit page semantics and total/page count awareness

## Data Layer Pattern

- Data function:
  - Apply validated `limit`
  - Query with `take: limit + 1`
  - If cursor is present: `{ cursor: { id: cursor }, skip: 1 }`
  - Return `{ items, nextCursor }`
- API route:
  - Parse and validate `cursor` and `limit`
  - Pass through to data function
- Client:
  - Use `useInfiniteQuery`
  - `getNextPageParam` returns `nextCursor ?? undefined`
  - Flatten page items for rendering

## Recording exceptions

Keep a list of surfaces that deliberately deviate, with the reason. Two recurring legitimate cases:

- Reverse-direction chat paging that must preserve scroll anchoring and read position
- Moderation queues where reviewers need auditable page semantics and explicit total visibility
