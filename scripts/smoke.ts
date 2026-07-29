import assert from "node:assert/strict";
import {
  bigIntStringify,
  bigIntParse,
  toBigInt,
  buildDynamicRoutePath,
  truncateString,
  stableHash,
} from "@mydaogs/core";
import {
  CACHE_TIMES,
  getIdentityScopeKey,
  createShouldDehydrateQuery,
} from "@mydaogs/query";
import {
  createActionResponse,
  AppBusinessError,
  redact,
  isVisible,
  createPublicPathValidator,
  createBackendFetch,
  isBackendHealthResponse,
  setGenericErrorMessage,
  createActionResponseFactory,
} from "@mydaogs/contract";
import { computeRetryAt, computeStatusGapRetryAt, isNewerChainEvent, classifyProjectionFailure, StatusProjectionGapError, QuarantineProjectionError, computeEventHash } from "@mydaogs/indexer";
import { getSyncRecoveryAction } from "../packages/web3-tx/src/reconcile.ts";
import {
  selectPendingTxScope,
  buildPendingTxConflictKey,
  createBudgetedTxSync,
  invalidateQueryKeys,
  selectWatchableEntries,
  selectDueEntries,
} from "@mydaogs/web3-tx";
import { partitionTags, dedupeTags } from "@mydaogs/cache-handler";

// bigint round trip is lossless and does not capture look-alike strings
const wire = bigIntStringify({ amount: 10n ** 30n, note: "1000", n: 5 });
assert.equal(wire.includes("__bigint__"), true);
const back = bigIntParse<{ amount: bigint; note: string; n: number }>(wire);
assert.equal(back.amount, 10n ** 30n);
assert.equal(back.note, "1000");          // stayed a string
assert.equal(back.n, 5);
assert.equal(toBigInt("42"), 42n);
assert.equal(toBigInt("nope"), null);

// typed route paths
assert.equal(buildDynamicRoutePath("/entity/[id]/tab/[slug]", { id: "a", slug: "b" }), "/entity/a/tab/b");
assert.equal(truncateString({ value: "0x" + "a".repeat(64) }), "0xaaaa…aaaa");

// action envelope preserves code/params off AppBusinessError
const fail = createActionResponse({ error: new AppBusinessError("nope", 403, "FORBIDDEN", { max: 5 }) });
assert.equal(fail.success, false);
assert.equal(fail.errorCode, "FORBIDDEN");
assert.equal(fail.errorStatus, 403);
assert.deepEqual(fail.errorParams, { max: 5 });
// anything unexpected collapses to a generic message
assert.equal(createActionResponse({ error: new Error("db conn string leak") }).errorMessage, "A server error has occurred.");
assert.deepEqual(createActionResponse(), { success: true, data: null });

// redaction hides the id entirely
const hidden = redact({ id: "org1", name: "Acme" }, false);
assert.equal(isVisible(hidden), false);
assert.equal(JSON.stringify(hidden).includes("org1"), false);
assert.equal(isVisible(redact({ id: "org1", name: "Acme" }, true)), true);

// public path lane rejects anything not allowlisted
const validate = createPublicPathValidator(["/public-data/getThing"] as const);
const publicOrigin = "https://api.example.com";
validate("/public-data/getThing?id=1", publicOrigin);
assert.throws(() => validate("/data/getSecret", publicOrigin));
assert.throws(() => validate("https://evil.example/x", publicOrigin));
// SSRF: these resolve to an allowlisted PATH under a dummy base but a foreign
// HOST under the real origin, and would return attacker JSON as a trusted
// ApiResponse.
assert.throws(
  () => validate("//evil.example/public-data/getThing", publicOrigin),
  /Refusing a public backend request/,
);
assert.throws(
  () => validate("\\\\evil.example/public-data/getThing", publicOrigin),
  /Refusing a public backend request/,
);

// backoff: normal lane dead-letters, status gap never does
assert.notEqual(computeRetryAt(0), null);
assert.equal(computeRetryAt(8), null);
assert.ok(computeStatusGapRetryAt(99) instanceof Date);

// ordering watermark
assert.equal(isNewerChainEvent({ blockNumber: 5n, logIndex: 1 }, null), true);
assert.equal(isNewerChainEvent({ blockNumber: 5n, logIndex: 1 }, { blockNumber: 5n, logIndex: 2 }), false);
assert.equal(isNewerChainEvent({ blockNumber: 5n, logIndex: 3 }, { blockNumber: 5n, logIndex: 2 }), true);
assert.equal(isNewerChainEvent({ blockNumber: 4n, logIndex: 9 }, { blockNumber: 5n, logIndex: 0 }), false);

// failure taxonomy
assert.equal(classifyProjectionFailure(new StatusProjectionGapError("A", "B")).retryable, true);
assert.equal(classifyProjectionFailure(new QuarantineProjectionError("BAD", "x")).retryable, false);
assert.equal(classifyProjectionFailure(new Error("rpc timeout")).retryable, true);

// sync recovery: 401 pauses, 5xx/429 retry, deterministic 4xx is terminal
assert.equal(getSyncRecoveryAction(new AppBusinessError("x", 401)), "pause-auth");
assert.equal(getSyncRecoveryAction(new AppBusinessError("x", 503)), "retry");
assert.equal(getSyncRecoveryAction(new AppBusinessError("x", 429)), "retry");
assert.equal(getSyncRecoveryAction(new AppBusinessError("x", 409, "SYNC_IN_PROGRESS")), "retry");
assert.equal(getSyncRecoveryAction(new AppBusinessError("x", 400, "BAD_INPUT")), "terminal");

// event hash is stable and chain-scoped
const h = (chainId: number) => computeEventHash({ txHash: ("0x" + "1".repeat(64)) as `0x${string}`, logIndex: 3, chainId });
assert.equal(h(1), h(1));
assert.notEqual(h(1), h(11155111));

// tag partitioning keeps other principals' ids out of the envelope
const { envelope, internal } = partitionTags(
  ["entity:list", "user:u1:inbox", "entity:list"],
  (t) => !t.startsWith("user:"),
);
assert.deepEqual(envelope, ["entity:list"]);
assert.deepEqual(internal, ["user:u1:inbox"]);
assert.deepEqual(dedupeTags(["a", "a", "b"]), ["a", "b"]);

console.log("all smoke assertions passed");

// ── Regression assertions ────────────────────────────────────────────────
// Each of these pins a bug that was found in review. They fail loudly if the
// behaviour ever regresses.

// buildDynamicRoutePath: `$` sequences must be literal, not replacement patterns
assert.equal(buildDynamicRoutePath("/u/[id]", { id: "a$&b" }), "/u/a$&b");
assert.equal(buildDynamicRoutePath("/u/[id]/x", { id: "a$'b" }), "/u/a$'b/x");
assert.equal(buildDynamicRoutePath("/u/[id]", { id: "a$`b" }), "/u/a$`b");
assert.equal(buildDynamicRoutePath("/u/[id]", { id: "a$1b" }), "/u/a$1b");
// catch-all segment names contain regex metacharacters
assert.equal(buildDynamicRoutePath("/u/[...slug]", { "...slug": "a/b" }), "/u/a/b");
// opt-in encoding contains a traversal attempt to one segment
assert.equal(
  buildDynamicRoutePath("/u/[id]", { id: "a/../admin" }, { encode: true }),
  "/u/a%2F..%2Fadmin",
);

// credentialed fetch must refuse every form that resolves off-origin.
// Pinning only `^https?://` inputs leaves scheme-relative forms open: WHATWG
// URL normalizes backslashes for special schemes, so all three below swap the
// host while inheriting the scheme.
{
  const { backendFetch } = createBackendFetch({
    getOrigin: () => "https://api.example.com",
    publicPaths: ["/public-data/x"] as const,
  });

  const offOrigin = [
    "https://evil.example/steal",
    "//evil.example/steal",
    "\\\\evil.example/steal",
    "\\/evil.example/steal",
  ];
  for (const target of offOrigin) {
    await assert.rejects(
      () => backendFetch(target),
      /Refusing to send a credentialed request/,
      `must refuse ${JSON.stringify(target)}`,
    );
  }
}

// health probe must reject a different app exposing a contractVersion
assert.equal(
  isBackendHealthResponse({ status: "ok", app: "other", contractVersion: "v1" }, "backend"),
  false,
);
assert.equal(
  isBackendHealthResponse({ status: "ok", app: "backend", contractVersion: "v1" }, "backend"),
  true,
);

// generic error message is injectable rather than hardcoded English
setGenericErrorMessage("Une erreur est survenue.");
assert.equal(
  createActionResponse({ error: new Error("leak") }).errorMessage,
  "Une erreur est survenue.",
);
setGenericErrorMessage("A server error has occurred.");

// per-request seam: two locales concurrently, no shared mutable default
{
  const en = createActionResponseFactory({ genericMessage: "Server error." });
  const fr = createActionResponseFactory({ genericMessage: "Erreur serveur." });
  assert.equal(en({ error: new Error("x") }).errorMessage, "Server error.");
  assert.equal(fr({ error: new Error("x") }).errorMessage, "Erreur serveur.");
  // the bound factory keeps the overload behaviour
  assert.deepEqual(en(), { success: true, data: null });
  assert.deepEqual(en({ data: 7 }), { success: true, data: 7 });
  // a coded business error still keeps its own message, not the fallback
  assert.equal(
    fr({ error: new AppBusinessError("specific", 403, "FORBIDDEN") }).errorMessage,
    "specific",
  );
}

// bigint-safe dedupe hash: JSON.stringify throws on these keys
assert.equal(stableHash(["readContract", { args: [1n] }]), stableHash(["readContract", { args: [1n] }]));
assert.notEqual(stableHash(["a", 1n]), stableHash(["a", 1]));
// key order must not change the hash, or dedupe misses structural duplicates
assert.equal(stableHash({ a: 1, b: 2 }), stableHash({ b: 2, a: 1 }));

// a malformed bigint wrapper must not abort the whole parse
{
  const parsed = bigIntParse<{ a: unknown; b: number }>('{"a":{"__bigint__":"abc"},"b":1}');
  assert.equal(parsed.b, 1, "sibling keys survive a malformed wrapper");
  assert.equal(toBigInt(parsed.a), null, "and the bad field resolves to null");
}

// redaction discriminant must win over a same-named domain field
{
  const out = redact({ visibility: "sneaky", id: "x" } as never, true);
  assert.equal((out as { visibility: string }).visibility, "public");
  assert.equal(isVisible(out), true);
}

// identity scope must not collide across separator-bearing ids
assert.notEqual(
  getIdentityScopeKey({ userId: "a:b", organizationId: "c", memberId: "d" }),
  getIdentityScopeKey({ userId: "a", organizationId: "b:c", memberId: "d" }),
);

// gcTime must not evict an entry that is still considered fresh
for (const [name, tier] of Object.entries(CACHE_TIMES)) {
  if (tier.staleTime === 0) continue;
  assert.ok(tier.gcTime >= tier.staleTime, `${name}: gcTime must be >= staleTime`);
}

// dehydrate filter excludes sensitive roots, pending, and errored queries
{
  const shouldDehydrate = createShouldDehydrateQuery({
    excludedKeyRoots: ["deal-terms"],
    excludedExternalRoots: ["readContract"],
  });
  const q = (key: unknown[], status = "success", fetchStatus = "idle") =>
    ({ queryKey: key, state: { status, fetchStatus } }) as never;
  assert.equal(shouldDehydrate(q(["public-list"])), true);
  assert.equal(shouldDehydrate(q(["deal-terms", "1"])), false);
  assert.equal(shouldDehydrate(q(["readContract", {}])), false);
  assert.equal(shouldDehydrate(q(["public-list"], "pending")), false);
  assert.equal(shouldDehydrate(q(["public-list"], "error")), false);
  assert.equal(shouldDehydrate(q(["public-list"], "success", "fetching")), false);
}

// pending-tx scope selection: variant is normative, warnings never block
{
  type SmokeItem = {
    entityId: string;
    conflictKey: string;
    actionKey: string;
    variant: "replace" | "additive";
    entityType?: string;
  };

  const entry = (
    hash: string,
    timestamp: number,
    phase: "pending" | "reconciling" | "warning",
    items: SmokeItem[],
    account: `0x${string}` | null = null,
  ) =>
    [
      hash,
      {
        version: 1 as const,
        hash: hash as `0x${string}`,
        timestamp,
        phase,
        account,
        reconciliationMode: "invalidate-only" as const,
        queryKeysToInvalidate: [],
        retryCount: 0,
        pendingItems: items.map((i) => ({
          entityType: i.entityType ?? "lot",
          entityId: i.entityId,
          conflictKey: i.conflictKey,
          actionKey: i.actionKey,
          variant: i.variant,
        })),
      },
    ] as const;

  const key = (id: string, conflict: string) =>
    buildPendingTxConflictKey(id, conflict);
  const hashes = (views: Array<{ txHash: string }>) =>
    views.map((v) => v.txHash).sort();

  // `replace`: a newer write supersedes the older one for visibility.
  {
    const store = Object.fromEntries([
      entry("0xa", 100, "pending", [
        { entityId: "l1", conflictKey: "terms", actionKey: "a1", variant: "replace" },
      ]),
      entry("0xb", 200, "pending", [
        { entityId: "l1", conflictKey: "terms", actionKey: "a2", variant: "replace" },
      ]),
    ]) as never;
    const s = selectPendingTxScope({ store });
    assert.equal(s.visibleEntries.length, 1);
    assert.equal(s.visibleEntries[0]!.txHash, "0xb");
    assert.equal(s.blockingEntryByConflictKey.get(key("l1", "terms"))?.txHash, "0xb");
  }

  // `additive`: both stay visible; the newest active holds the block. This is
  // the case `timestamp`-only precedence cannot express.
  {
    const store = Object.fromEntries([
      entry("0xa", 100, "pending", [
        { entityId: "o1", conflictKey: "admin-role", actionKey: "a1", variant: "additive" },
      ]),
      entry("0xb", 200, "pending", [
        { entityId: "o1", conflictKey: "admin-role", actionKey: "a2", variant: "additive" },
      ]),
    ]) as never;
    const s = selectPendingTxScope({ store });
    assert.equal(s.visibleEntries.length, 2);
    assert.equal(s.blockingEntryByConflictKey.get(key("o1", "admin-role"))?.txHash, "0xb");
    assert.equal(s.blockingEntryByActionKey.get("a1")?.txHash, "0xa");
    assert.equal(s.blockingEntryByActionKey.get("a2")?.txHash, "0xb");
  }

  // A terminal warning stays visible but must not take the blocking slot from
  // an older entry that is still active.
  {
    const store = Object.fromEntries([
      entry("0xa", 100, "pending", [
        { entityId: "l1", conflictKey: "terms", actionKey: "a1", variant: "replace" },
      ]),
      entry("0xb", 200, "warning", [
        { entityId: "l1", conflictKey: "terms", actionKey: "a2", variant: "replace" },
      ]),
    ]) as never;
    const s = selectPendingTxScope({ store });
    assert.equal(s.visibleEntries[0]!.txHash, "0xb");
    assert.equal(s.blockingEntryByConflictKey.get(key("l1", "terms"))?.txHash, "0xa");
    assert.equal(s.blockingEntries.every((e) => e.status !== "warning"), true);
  }

  // Entity, visible-id, and account filtering.
  {
    const store = Object.fromEntries([
      entry("0xa", 100, "pending", [
        { entityId: "l1", conflictKey: "terms", actionKey: "a1", variant: "replace" },
      ]),
      entry("0xb", 100, "pending", [
        { entityId: "w1", conflictKey: "state", actionKey: "a2", variant: "replace", entityType: "wallet" },
      ]),
      entry(
        "0xc",
        100,
        "pending",
        [{ entityId: "l2", conflictKey: "terms", actionKey: "a3", variant: "replace" }],
        "0xAAAA000000000000000000000000000000000000",
      ),
    ]) as never;

    assert.deepEqual(hashes(selectPendingTxScope({ store, entityType: "lot" }).allEntries), ["0xa", "0xc"]);
    assert.deepEqual(hashes(selectPendingTxScope({ store, visibleEntityIds: ["l1"] }).allEntries), ["0xa"]);
    assert.deepEqual(
      hashes(selectPendingTxScope({ store, visibleEntityIds: ["l1"], includeUnmatchedEntries: true }).allEntries),
      ["0xa", "0xb", "0xc"],
    );
    // Explicitly disconnected admits only account-less entries.
    assert.deepEqual(hashes(selectPendingTxScope({ store, account: null }).allEntries), ["0xa", "0xb"]);
    // Case-insensitive, so a checksum difference cannot silently drop an entry.
    assert.deepEqual(
      hashes(
        selectPendingTxScope({
          store,
          account: "0xaaaa000000000000000000000000000000000000",
        }).allEntries,
      ),
      ["0xa", "0xb", "0xc"],
    );
    // An empty visible set is not the same as an absent one.
    assert.deepEqual(selectPendingTxScope({ store, visibleEntityIds: [] }).allEntries, []);
  }

  // `retrying` is derived from retry bookkeeping, not a stored phase.
  {
    const [, base] = entry("0xa", Date.now(), "reconciling", [
      { entityId: "l1", conflictKey: "terms", actionKey: "a1", variant: "replace" },
    ]);
    const store = { "0xa": { ...base, retryCount: 2 } } as never;
    assert.equal(selectPendingTxScope({ store }).allEntries[0]!.status, "retrying");
    const idle = { "0xa": { ...base, phase: "pending" as const } } as never;
    assert.equal(selectPendingTxScope({ store: idle }).allEntries[0]!.status, "pending");
  }
}

// budgeted tx sync: contention is waited out, deterministic failures are not
{
  const HASH = `0x${"a".repeat(64)}` as `0x${string}`;

  // Succeeds on the third attempt; the elapsed budget must cover it.
  {
    let calls = 0;
    const sync = createBudgetedTxSync({
      attempt: async () => {
        calls += 1;
        return calls < 3
          ? { success: false, errorCode: "SYNC_IN_PROGRESS" }
          : { success: true };
      },
      retry: { delayMs: 1, backoffMultiplier: 2, maxDelayMs: 4, maxElapsedMs: 500 },
    });
    await sync(HASH);
    assert.equal(calls, 3);
  }

  // A non-retryable code fails on the first attempt rather than burning budget.
  {
    let calls = 0;
    const sync = createBudgetedTxSync({
      attempt: async () => {
        calls += 1;
        return { success: false, errorCode: "ACCESS_DENIED", errorMessage: "nope", errorStatus: 403 };
      },
      retry: { delayMs: 1, maxElapsedMs: 500 },
    });
    await assert.rejects(() => sync(HASH));
    assert.equal(calls, 1);
  }

  // Exhaustion throws, and the thrown error still classifies as retryable so
  // the durable record survives for a later attempt.
  {
    const sync = createBudgetedTxSync({
      attempt: async () => ({
        success: false,
        errorCode: "SYNC_IN_PROGRESS",
        errorMessage: "busy",
        errorStatus: 409,
      }),
      retry: { delayMs: 1, backoffMultiplier: 1, maxDelayMs: 1, maxElapsedMs: 10 },
    });
    await assert.rejects(
      () => sync(HASH),
      (error: unknown) => {
        assert.equal(getSyncRecoveryAction(error), "retry");
        return true;
      },
    );
  }

  // throwOnExhausted: false resolves instead of throwing.
  {
    const sync = createBudgetedTxSync({
      attempt: async () => ({ success: false, errorCode: "SYNC_IN_PROGRESS" }),
      retry: { delayMs: 1, maxElapsedMs: 5 },
      throwOnExhausted: false,
    });
    await sync(HASH);
  }

  // retry: false still makes exactly one attempt.
  {
    let calls = 0;
    const sync = createBudgetedTxSync({
      attempt: async () => {
        calls += 1;
        return { success: false, errorCode: "SYNC_IN_PROGRESS" };
      },
      retry: false,
    });
    await assert.rejects(() => sync(HASH));
    assert.equal(calls, 1);
  }
}

// invalidation attempts every key even when one fails
{
  const attempted: string[] = [];
  const queryClient = {
    invalidateQueries: async (filters: { queryKey: readonly unknown[] }) => {
      const root = String(filters.queryKey[0]);
      attempted.push(root);
      if (root === "b") throw new Error("refetch failed");
    },
  } as never;

  await assert.rejects(() =>
    invalidateQueryKeys({
      queryClient,
      queryKeysToInvalidate: [["a"], ["b"], ["c"]],
    }),
  );
  // A sequential loop that threw on "b" would never reach "c", leaving part of
  // the UI stale after a confirmed transaction.
  assert.deepEqual(attempted.sort(), ["a", "b", "c"]);

  // Dedupe survives bigint-bearing keys, which JSON.stringify would throw on.
  const seen: string[] = [];
  const counting = {
    invalidateQueries: async (filters: { queryKey: readonly unknown[] }) => {
      seen.push(String(filters.queryKey[0]));
    },
  } as never;
  await invalidateQueryKeys({
    queryClient: counting,
    queryKeysToInvalidate: [
      ["lot", { id: 1n }],
      ["lot", { id: 1n }],
      ["lot", { id: 2n }],
    ],
  });
  assert.equal(seen.length, 2);
}

// watcher eligibility: ownership and lifecycle only, never presentation
{
  const rec = (
    hash: string,
    over: Partial<{
      phase: "pending" | "reconciling" | "warning";
      account: `0x${string}` | null;
      successMessage: string;
      nextRetryAt: number;
    }> = {},
  ) => ({
    version: 1 as const,
    hash: hash as `0x${string}`,
    timestamp: 100,
    phase: over.phase ?? ("pending" as const),
    account: over.account ?? null,
    reconciliationMode: "invalidate-only" as const,
    queryKeysToInvalidate: [],
    retryCount: 0,
    pendingItems: [
      { entityType: "lot", entityId: "l1", conflictKey: "terms", actionKey: "a", variant: "replace" as const },
    ],
    ...(over.successMessage !== undefined ? { successMessage: over.successMessage } : {}),
    ...(over.nextRetryAt !== undefined ? { nextRetryAt: over.nextRetryAt } : {}),
  });

  const never = () => false;
  const hashesOf = (entries: Array<{ hash: string }>) =>
    entries.map((e) => e.hash).sort();

  // A record without a success string is still work. Filtering the watcher's
  // source on presentation copy stranded the majority of writes.
  {
    const store = {
      a: rec("0xa"),
      b: rec("0xb", { successMessage: "done" }),
    } as never;
    assert.deepEqual(
      hashesOf(selectWatchableEntries({ store, isLiveOwner: never })),
      ["0xa", "0xb"],
    );
  }

  // Terminal warnings and live-owned records are not resumable.
  {
    const store = {
      a: rec("0xa"),
      b: rec("0xb", { phase: "warning" }),
      c: rec("0xc"),
    } as never;
    assert.deepEqual(
      hashesOf(
        selectWatchableEntries({ store, isLiveOwner: (h) => h === "0xc" }),
      ),
      ["0xa"],
    );
  }

  // Account scoping: a disconnected visitor resumes only account-less records.
  {
    const mine = "0xAAAA000000000000000000000000000000000000" as `0x${string}`;
    const store = {
      a: rec("0xa"),
      b: rec("0xb", { account: mine }),
      c: rec("0xc", { account: "0xBBBB000000000000000000000000000000000000" }),
    } as never;
    assert.deepEqual(
      hashesOf(selectWatchableEntries({ store, account: null, isLiveOwner: never })),
      ["0xa"],
    );
    // Case-insensitive, so a checksum difference cannot strand a record.
    assert.deepEqual(
      hashesOf(
        selectWatchableEntries({
          store,
          account: mine.toLowerCase() as `0x${string}`,
          isLiveOwner: never,
        }),
      ),
      ["0xa", "0xb"],
    );
  }

  // Scheduled retries are held back until due.
  {
    const now = 1_000_000;
    const entries = [
      rec("0xa"),
      rec("0xb", { nextRetryAt: now - 1 }),
      rec("0xc", { nextRetryAt: now + 5000 }),
    ] as never;
    assert.deepEqual(hashesOf(selectDueEntries(entries, now)), ["0xa", "0xb"]);
  }
}

console.log("all regression assertions passed");
