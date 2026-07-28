/**
 * Regression coverage for the storage layer, which needs a `window`.
 * Run separately from smoke.ts so that file stays dependency-free.
 */
import assert from "node:assert/strict";

class FakeStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const storageBackend = new FakeStorage();
(globalThis as Record<string, unknown>).window = {
  localStorage: storageBackend,
  addEventListener: () => {},
};

const { createTxSyncStorage } = await import("../packages/web3-react/src/txSyncStorage.ts");
const { createTxSyncVocabulary } = await import("../packages/web3-react/src/vocabulary.ts");

const vocabulary = createTxSyncVocabulary({
  entities: { ORDER: "order" },
  actions: { PLACE: "order:place" },
  conflicts: { ACTIVE: "active" },
});
const storage = createTxSyncStorage({ vocabulary, lockNamespace: "test" });

const hash = (n: string) => ("0x" + n.repeat(64)) as `0x${string}`;
const entry = (h: `0x${string}`) => ({
  hash: h,
  timestamp: Date.now(),
  phase: "pending" as const,
  account: null,
  reconciliationMode: "invalidate-only" as const,
  pendingItems: [
    { entityType: "order", entityId: "e1", conflictKey: "active", actionKey: "order:place" },
  ] as const,
});

// A stale record sits between two valid ones. Reading it deletes it mid-scan.
storageBackend.setItem("tx_sync:" + hash("1"), JSON.stringify({ version: 99, junk: true }));
storage.saveEntry(entry(hash("2")));
storage.saveEntry(entry(hash("3")));

const store = storage.getSnapshot();
const found = Object.keys(store).sort();
assert.deepEqual(
  found,
  [hash("2"), hash("3")].sort(),
  "REGRESSION: a stale record must not hide the record that follows it",
);
assert.equal(storageBackend.getItem("tx_sync:" + hash("1")), null, "stale record is purged");

// Hydration rejects an unrecognized vocabulary rather than repairing it
storageBackend.clear();
storageBackend.setItem(
  "tx_sync:" + hash("4"),
  JSON.stringify({ ...entry(hash("4")), pendingItems: [
    { entityType: "unknown-entity", entityId: "e", conflictKey: "active", actionKey: "order:place" },
  ] }),
);
assert.equal(storage.readEntry(hash("4")), null, "unknown entity is rejected");
assert.equal(storageBackend.getItem("tx_sync:" + hash("4")), null, "and purged");

console.log("all storage regression assertions passed");
