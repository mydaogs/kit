# Shared packages

Portable package kit for Next.js + web3 projects on this stack. Companion to [`../shared-docs/`](../shared-docs/README.md): the docs describe the patterns, these packages implement them

Everything here is domain-free. No product entities, no deployment identifiers, no hardcoded chains or routes

## Packages

| Package | Runtime | Peer deps | What it owns |
| --- | --- | --- | --- |
| `@kit/core` | isomorphic, zero-dep | — | bigint JSON wire protocol, typed dynamic route paths, type helpers |
| `@kit/contract` | isomorphic | — | response envelope, error classes, redaction unions, public-path lane, build-time version probe, fetch factory |
| `@kit/kv` | server | `@upstash/redis` | Redis client with lazy env resolution |
| `@kit/cache-handler` | Next cache runtime | — | distributed cache handler, cross-app invalidation publisher, tag registry |
| `@kit/query` | React | `react`, `@tanstack/react-query` | cache tiers, query-fn factories, fail-closed identity-scoped cache reset |
| `@kit/web3` | isomorphic | `viem`, `zod` | chain resolution, env refinements, bytes32, explorer URLs, revert decoding |
| `@kit/web3-react` | React | `wagmi`, `viem`, `@tanstack/react-query` | durable pending-tx registry, contract-write wrapper, pending scope selector |
| `@kit/indexer` | server | `viem` | event hash, atomic claim contract, capped backoff, ordering watermarks, failure taxonomy |

### Why this split

Grouping is by **dependency boundary and runtime environment**, not by feature area. Unifying further would force wrong peer dependencies — a backend importing React, a browser bundle importing Redis

Three boundaries are deliberate and should not be collapsed:

- **`kv` stays out of `cache-handler`.** Reader apps load the compiled cache handler outside Next's transpile pipeline, so a bare workspace specifier there is unresolvable on a serverless host's flattened layout. `cache-handler` declares a structural `KvClient` interface and the host passes its own singleton in
- **`web3` is separate from `web3-react`.** A backend needs chain resolution and bytes32 helpers with no React in the graph
- **`query` is separate from `web3-react`.** Query conventions are useful in projects with no chain at all

## Install

```bash
cd shared-packages
pnpm install
pnpm check     # typecheck + lint all packages, run behavioral and regression tests
```

## Consuming

The packages export TypeScript source (`"exports": { ".": "./src/index.ts" }`), matching the workspace-package convention this stack already uses — consumers transpile them through Next. Add each package to the consuming app's `transpilePackages`

To publish to a registry instead, add a build step per package and point `exports` at the emitted `dist`. Build scripts are intentionally absent here because the repo hard-rules prohibit adding `build`/`start` scripts to any `package.json`

`@kit/cache-handler` additionally needs `runtime/*.mjs` codegen — see [`packages/cache-handler/scripts/README.md`](packages/cache-handler/scripts/README.md)

## Wiring the pieces

Most packages are factories rather than singletons, so a project supplies its own vocabulary, copy, and transport. A minimal wire-up:

```ts
// transport — one place owns the origin, the allowlist, and the version gate
const verifyContract = createContractVerifier({
  expectedVersion: BACKEND_CONTRACT_VERSION,
  expectedApp: "backend",
  healthUrl: () => `${origin}/health`,
  // Required. This is a BUILD-time gate — running it at request time makes a
  // network probe a dependency of every request.
  shouldVerify: () => process.env.NEXT_PHASE === "phase-production-build",
});

export const { backendFetch, publicBackendFetch } = createBackendFetch({
  getOrigin: () => process.env.NEXT_PUBLIC_BACKEND_API_ORIGIN ?? "",
  publicPaths: PUBLIC_BACKEND_GET_PATHS,
  verifyContract,
});

// pending-transaction registry — project owns the vocabularies
const storage = createTxSyncStorage({
  vocabulary: createTxSyncVocabulary({
    entities: TX_ENTITY,
    actions: TX_ACTION,
    conflicts: TX_CONFLICT,
  }),
  lockNamespace: "myapp",
});

export const useAppWriteContract = createUseAppWriteContract({
  storage,
  toast: myToastAdapter,
  messages: myLocalizedTxMessages,
  getExplorerTxUrl: createExplorerUrls(chain).txUrl,
  syncTxHash,
  sessionQueryKey: [SESSION_QUERY_KEY],
});

export const usePendingTxScope = createUsePendingTxScope(storage);

// persisted query cache — BOTH halves of the identity defense are required
const shouldDehydrateQuery = createShouldDehydrateQuery({
  excludedKeyRoots: PROTECTED_FINANCIAL_KEYS.concat(IDENTITY_SENSITIVE_KEYS),
  excludedExternalRoots: ["readContract"],
});
// plus: a persister `buster` bumped on any incompatible shape change, and one
// authoritative fresh session fetch after restore. See the invariants below.
```

## Invariants worth preserving

These are the non-obvious properties. Changing them silently breaks correctness rather than failing loudly:

- **The tx registry stores no render payload.** UI shows server or chain truth until reconciliation refetches it, so there is never a local value that can disagree with the chain. Adding a projected value reintroduces the whole optimistic-reconciliation problem
- **Cross-tab ownership is queued before the durable record is written.** Otherwise a watcher woken by the storage event can overtake the submitting hook in the lock queue and reconcile a transaction whose callbacks live in another tab
- **Durable settlement and callbacks are fenced separately.** Settlement must complete after the surface unmounts or the record leaks; callbacks belong to the mounted surface and cannot transfer to a watcher
- **Identity-scoped cache reset fails closed.** An unrecognized query key is dropped, not kept. A denylist leaks the moment someone adds a hook and forgets to register it, and the failure is invisible
- **Redaction returns a narrowed union.** The `hidden` branch carries no id, so a restricted viewer cannot receive it and TypeScript forces the check
- **Status gaps never dead-letter.** They resolve once the missing intermediate event lands; an attempt cap would strand a recoverable projection
- **Cache-tag state is cleared wholesale when any tag is dropped.** Soft tags are passed at read time and not recorded on the entry, so dependents cannot be identified individually
- **The public fetch lane is enforced at runtime**, not documented. It throws on bodies, non-GET methods, credential overrides, and custom headers, so it cannot drift into sending cookies or triggering a preflight
- **The credentialed fetcher pins the *resolved* origin.** Every request is resolved against the configured origin and compared once, because `credentials: "include"` would otherwise forward the session cookie wherever a caller names. Pinning only inputs that look absolute (`^https?://`) is insufficient: `//evil.example/x`, `\\evil.example/x` and `\/evil.example/x` all resolve to a foreign host while inheriting the scheme, since WHATWG URL normalizes backslashes for special schemes
- **Storage keys are materialized before any entry is read.** `readEntry` purges invalid records, and `Storage.key(i)` is a live index — deleting mid-scan shifts later keys down and skips them, hiding a pending transaction from the watcher entirely
- **External query roots are admitted by predicate, not by root name.** A root allowlist cannot express a partial carve-out, and a wallet library's `readContract` root covers both harmless chain reads and viewer-scoped financial ones
- **`Object.freeze` does not protect a Set or Map.** Their contents live in internal slots, so a frozen empty collection is still mutable. The `Readonly*` types are the real protection; shared empty singletons are built fresh per call instead
- **Query keys are hashed with `stableHash`, never `JSON.stringify`.** Wallet-library keys routinely carry bigints, and stringify throws on them — dedupe would fail before any invalidation ran, turning every confirmed transaction into a false refresh-warning. The same applies to persisting the durable record, which uses the tagged bigint protocol
- **The identity defense has three parts, not one.** `useResetCacheOnIdentityChange` clears on an observed transition; `createShouldDehydrateQuery` bounds what reaches disk at all; a persister `buster` discards an incompatible shape. Shipping only the first leaves private payloads recoverable from `localStorage`. An anonymous *first* identity is treated as a transition, not a clean baseline, because that is what an expired session over a restored cache looks like
- **The contract probe memoizes success only.** Caching a rejected promise makes one transient health-endpoint blip permanent for the process lifetime, rejecting every later request with a failure it cannot retry
- **Both fetch lanes validate the resolved URL.** The public lane validating a throwaway parse is unsound: `//evil.example/public-data/x` yields an allowlisted *pathname* under a dummy base but a foreign *host* under the real origin, returning attacker JSON as a trusted `ApiResponse`
- **The tx registry validates on write as well as read.** Persisting a record the reader will reject creates one that purges itself on first read; the submitting hook then reads the absence as "another tab settled it", so the toast never clears and `onSuccess` never fires
- **A publish failure's tag manifest is readable back.** `markFailed` persists it and `getPendingCacheTags` returns it, because an idempotent handler requests no tags on replay — without the read path the manifest is unreachable and the invalidation is lost permanently
- **`ORPHANED` gets exactly one retry.** Its dominant cause is a webhook arriving before the offchain row commits, which self-heals within a backoff cycle; a genuinely missing referent still terminates on the second attempt

## Verification

`pnpm check` runs three things:

- `check-types` — all 8 packages under `strict` with `noUncheckedIndexedAccess`
- `lint` — eslint flat config across every package and script, `--max-warnings 0`
- `verify` — behavioral assertions over the pure logic:
  - [`scripts/smoke.ts`](scripts/smoke.ts) — bigint round-trip fidelity (including that look-alike strings survive), error-envelope code preservation and message sanitization, redaction leaking nothing, public-path rejection, backoff dead-lettering vs status-gap persistence, ordering watermarks, failure classification, sync recovery posture per status code, chain-scoped event hashing, tag partitioning, plus a regression block pinning every bug found in review
  - [`scripts/smoke-dom.ts`](scripts/smoke-dom.ts) — storage-layer regressions against a fake `localStorage`: a stale record must not hide the record that follows it, and an unrecognized vocabulary must be rejected and purged rather than repaired

The CI guards are **not** part of `pnpm check`. They target a consuming repo and now exit non-zero when handed a path with nothing to scan, so running them against this workspace correctly fails:

```bash
pnpm check:cache-handlers ../<monorepo>/apps
pnpm check:bare-revalidate ../<monorepo>/apps/backend/src
```

## CI guards

[`scripts/`](scripts/) carries two guards to copy into a consuming repo. The pattern matters more than the specific checks: an architectural invariant encoded as a script is worth more than one written in a doc

- `check-cache-handlers.mjs` — every `cacheComponents` app registers the handler *and* traces it in `outputFileTracingIncludes`
- `check-no-bare-revalidate.mjs` — backend-only writers do not call bare `revalidateTag`, with an `// allow:` escape hatch on the call line or the line above

Both fail loudly when they scan zero files. A guard that cannot distinguish "no violations" from "scanned nothing" reports success forever after a directory move — which is its own failure mode, and the first thing to check when one of these goes green unexpectedly.

`check-no-bare-revalidate` flags **every** bare `revalidateTag` in a backend-writer path rather than only those naming a tag registry on the same line, because the two most common real forms span lines:

```ts
const tag = APP_TAGS.userInbox(userId);
revalidateTag(tag);                     // variable indirection

revalidateTag(
  APP_TAGS.orgFeed(userId),             // multi-line call
);
```

## Relationship to the app packages

This is a **standalone kit**, not a refactor of `motherhunt-monorepo/packages/*`. The existing `@shared/*` packages continue to serve the apps unchanged. Adopting the kit in an existing app is a separate, opt-in migration
