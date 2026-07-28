import assert from "node:assert/strict";
import { bigIntStringify, bigIntParse, toBigInt, buildDynamicRoutePath, truncateString } from "@kit/core";
import { createActionResponse, AppBusinessError, redact, isVisible, createPublicPathValidator } from "@kit/contract";
import { computeRetryAt, computeStatusGapRetryAt, isNewerChainEvent, classifyProjectionFailure, StatusProjectionGapError, QuarantineProjectionError, computeEventHash } from "@kit/indexer";
import { getSyncRecoveryAction } from "../packages/web3-react/src/reconcile.ts";
import { partitionTags, dedupeTags } from "@kit/cache-handler";

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
validate("/public-data/getThing?id=1");
assert.throws(() => validate("/data/getSecret"));
assert.throws(() => validate("https://evil.example/x"));

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
