# Distributed cache handler for multi-deployment apps

## Context

An app that ships as several deployments (one per locale, region, or tenant)
shares nothing in memory. `revalidateTag` and `updateTag` from `next/cache`
invalidate only the calling deployment's in-process cache, so a mutation on one
deployment leaves peers stale. HTTP fan-out to peers is rejected because
invalidation cost must stay `O(1)` regardless of deployment count

## Decision

Route tag-invalidation timestamps through a shared Redis instance via Next's
`cacheHandlers.default`. Cache **values** stay in each deployment's in-process
memory — deployment-specific rendered output must not leak across deployments.
Only timestamps are global: one Redis pipeline write per `revalidateTag` /
`updateTag`, visible to every deployment on its next throttled `refreshTags()`
poll

`createDistributedCacheHandler({ appName, kvClient })` returns the Next
`CacheHandler` object. It buffers cached streams as bytes, reconstructs a fresh
`ReadableStream` on every hit, and keeps a bounded in-process LRU (default 5,000
entries / 50 MB)

Redis keys are scoped by `NEXT_CACHE_NAMESPACE` and `appName`, so environments
can share one instance and apps cannot invalidate each other. If the Redis env
vars are absent the factory falls back to an in-memory-only handler, so
single-process local development still works

## The kvClient parameter is the design

This package declares **no dependency on any Redis client**. The host passes its
own singleton in, and `KvClient` / `KvPipeline` are exported as structural
interfaces so any Redis-compatible client is assignable

That is not a convenience. Next loads a cache handler outside the app's module
graph, so this file and its imports must resolve without the app's bundler. A
dependency here would have to resolve in that context too, on whatever layout
the host flattens to. Taking the client as a parameter removes the question

For the same reason the published output is plain ESM that Node loads directly.
There is no codegen step, and the consuming app must not transpile this package

## Mechanism details worth preserving

- A ZSET is the delta index for `refreshTags`; a per-tag key carries the
  `(stale, expired)` tuple. Both are needed — without the tuple, an SWR-style
  bump from a peer collapses into hard invalidation on the receiving side
- An entry is expired only when the expire timestamp is in the past **and** the
  entry was created before it. Without the `<= now` guard, a future-dated expiry
  invalidates immediately instead of serving stale-while-revalidate until the
  deadline
- `refreshTags` is throttled with jitter and deduplicates concurrent calls behind
  a single in-flight promise
- Tag-state maps rely on `Map` insertion order for LRU eviction: re-inserting a
  bumped tag moves it to the tail, so the cap drops least-recently-bumped first
- **Tag state is cleared wholesale when any tag is dropped.** Soft tags are
  passed at read time and not recorded on the entry, so dependents cannot be
  identified individually — dropping one tag would let every entry that depended
  on it read as fresh again. Clearing everything mirrors a process restart. The
  overflow paths that trigger it fire rarely, so the cold-cache cost is bounded
- Old bump entries are trimmed opportunistically rather than on a schedule

## Cross-app invalidation

A writer app that needs to invalidate a *reader* app's deployments does not
register a handler for the reader. It publishes explicitly:

`publishCacheInvalidation({ kvClient, targetAppName, tags, mode })` writes the
same keys the handler reads — `next-cache:{namespace}:{targetAppName}:tag:{tag}`
and `:tag-bumps`

Targeting by `appName` is what keeps this safe: wiring a writer with the
reader's `appName` would mix LRU keys across deployments. A writer needs its own
handler only if its own surfaces adopt `"use cache"`, and then under its own
`appName`

## Publisher error semantics

`publishCacheInvalidation` **propagates** Redis errors. A Redis outage during a
save surfaces as a save failure; silent invalidation loss causes state drift
across deployments that is very hard to trace back. Callers needing tolerance
should catch at the call site rather than weakening the publisher

The handler's own `updateTags` is deliberately the opposite: it catches and logs,
so the peer write behind an ordinary `revalidateTag` **can fail invisibly**.
Same-app peer delivery is therefore not observable through `revalidateTag` alone.
A caller that gates durable state on delivery must publish its own `appName`'s
namespace and await it. Publishing a namespace the handler also writes is
idempotent — it is the same key pair

## Tag registry

`createCacheTagRegistry` builds typed tag factories; `dedupeTags` and
`partitionTags` split a mixed list into hard and soft sets. Keeping tag strings
behind a registry makes a rename a compile error on both the producing and
consuming side instead of a silent no-op

## Consequences

- Cross-deployment invalidation latency is bounded by `refreshThrottleMs`
  (default ~1000 ms with jitter)
- Cache values are discarded on deploy
- Cross-app invalidation is tag-only. Path invalidation does not cross apps
  because route trees differ
- Invalidating the function-level cache does not purge a CDN. An edge cache
  serves until its own window elapses, then re-checks and sees the bump

## Required environment

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — the shared instance
- `NEXT_CACHE_NAMESPACE` — mandatory whenever Redis env is present. Same value
  for deployments that should share invalidation, distinct per environment.
  Preview and production must not share a namespace

## Wiring

Registering the handler, tracing it, and matching publisher namespaces each fail
**silently** when missed — see [`scripts/README.md`](./scripts/README.md), which
ships with this package
