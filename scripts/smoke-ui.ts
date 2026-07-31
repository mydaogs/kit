/**
 * Regression coverage for @mydaogs/ui's pure logic: the dialog shell store
 * (its only stateful logic), `cn`, and `resolveImageSrc`. Imported by
 * relative source path — not a bare `@mydaogs/ui` specifier — so the root
 * package.json never needs `@mydaogs/ui` as a dependency (see the note in
 * package.json about avoiding an 18-Radix-package root install).
 */
import assert from "node:assert/strict";
import { createDialogShellStore } from "../packages/ui/src/dialog-shell/createDialogShellStore.ts";
import { cn } from "../packages/ui/src/cn.ts";
import { resolveImageSrc } from "../packages/ui/src/imageSrc.ts";
import { pathKey } from "../packages/ui/src/tabs-menu/utils.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeEl = () => ({}) as HTMLElement;

const makeEntry = (
  overrides: Partial<Parameters<ReturnType<typeof createDialogShellStore>["register"]>[0]>,
) => {
  const onClose = { calls: 0 };
  const onInvalidate = { calls: 0 };
  const entry = {
    id: "id",
    role: "stacked" as const,
    shellType: "normal" as const,
    title: "title",
    preventDialogOutsideInteraction: false,
    container: fakeEl(),
    backContainer: null,
    onClose: () => {
      onClose.calls += 1;
    },
    onInvalidate: () => {
      onInvalidate.calls += 1;
    },
    ...overrides,
  };
  return { entry, onClose, onInvalidate };
};

// ── cn ──────────────────────────────────────────────────────────────────
// tailwind-merge resolves conflicting utilities to the last one; clsx drops
// falsy values.
assert.equal(cn("p-2", "p-4"), "p-4");
const isLarge = false;
assert.equal(cn("text-sm", isLarge && "text-lg", "font-bold"), "text-sm font-bold");

// ── resolveImageSrc ─────────────────────────────────────────────────────
assert.equal(resolveImageSrc("/foo.png"), "/foo.png");
assert.equal(resolveImageSrc({ src: "/bar.png", width: 10 }), "/bar.png");
// CJS-interop shape: a statically-imported image module under `esModuleInterop`.
assert.equal(resolveImageSrc({ default: { src: "/baz.png" } }), "/baz.png");

// ── TabsMenu pathKey ────────────────────────────────────────────────────
assert.equal(pathKey(["a", "b"]), JSON.stringify(["a", "b"]));
assert.notEqual(pathKey(["a"]), pathKey(["a", "b"]));

// ── createDialogShellStore: base/stacked ordering ──────────────────────
{
  const store = createDialogShellStore();
  const { entry: s1 } = makeEntry({ id: "s1", role: "stacked" });
  const { entry: b1 } = makeEntry({ id: "b1", role: "base" });

  store.register(s1);
  store.register(b1);

  // A base entry always sorts to the front regardless of registration order.
  assert.deepEqual(
    store.getState().map((e) => e.id),
    ["b1"],
    "registering a base entry force-closes any active stacked entries",
  );
}

// ── forceCloseStacked on base registration ─────────────────────────────
{
  const store = createDialogShellStore();
  const { entry: s1, onClose: s1Close, onInvalidate: s1Invalidate } = makeEntry({
    id: "s1",
    role: "stacked",
  });
  const { entry: b1 } = makeEntry({ id: "b1", role: "base" });

  store.register(s1);
  store.register(b1);

  assert.equal(s1Close.calls, 1, "the stacked entry's onClose fires on force-close");
  assert.equal(s1Invalidate.calls, 1, "and onInvalidate fires so its registrar knows it was dropped");
  assert.deepEqual(store.getState().map((e) => e.id), ["b1"]);
}

// ── forceCloseStacked on baseKey change ────────────────────────────────
{
  const store = createDialogShellStore();
  const { entry: b1 } = makeEntry({ id: "b1", role: "base", baseKey: "k1" });
  store.register(b1);

  const { entry: s1, onClose: s1Close } = makeEntry({ id: "s1", role: "stacked" });
  store.register(s1);
  assert.equal(s1Close.calls, 0);

  store.update("b1", { baseKey: "k2" });
  assert.equal(s1Close.calls, 1, "changing the base entry's baseKey force-closes stacked entries");
  assert.deepEqual(store.getState().map((e) => e.id), ["b1"]);

  // A no-op patch (same baseKey) must not re-trigger the force-close path.
  const { entry: s2, onClose: s2Close } = makeEntry({ id: "s2", role: "stacked" });
  store.register(s2);
  store.update("b1", { baseKey: "k2" });
  assert.equal(s2Close.calls, 0, "an unchanged baseKey is a no-op");
}

// ── requestCloseAll: ack chain walks the stack top to bottom ───────────
{
  const store = createDialogShellStore();
  // Each entry's onClose accepts by calling unregister itself, exactly as a
  // real consumer's onClose -> setState(false) -> unmount would.
  const { entry: s1 } = makeEntry({
    id: "s1",
    role: "stacked",
    onClose: () => store.unregister("s1"),
  });
  const { entry: s2 } = makeEntry({
    id: "s2",
    role: "stacked",
    onClose: () => store.unregister("s2"),
  });
  store.register(s1);
  store.register(s2);

  store.requestCloseAll();

  assert.deepEqual(
    store.getState().map((e) => e.status),
    ["exiting", "exiting"],
    "an accepting close chain closes every entry top to bottom in one call",
  );
}

// ── requestCloseAll: a guarded refusal aborts after the grace window ───
{
  const store = createDialogShellStore();
  const guardCalls = { count: 0 };
  // A guarded onClose that no-ops (e.g. `if (isSubmitting) return`) never
  // unregisters, so the only signal is silence.
  const { entry: s1 } = makeEntry({
    id: "s1",
    role: "stacked",
    onClose: () => {
      guardCalls.count += 1;
    },
  });
  store.register(s1);

  store.requestCloseAll();
  assert.equal(guardCalls.count, 1);

  // Re-entrant call within the grace window is a no-op — a pending intent is
  // already in flight.
  store.requestCloseAll();
  assert.equal(guardCalls.count, 1, "a second requestCloseAll during the grace window is suppressed");

  await wait(350);

  // After the timeout aborts the pending intent, a fresh call goes through.
  store.requestCloseAll();
  assert.equal(guardCalls.count, 2, "after the grace window elapses, requestCloseAll can fire again");
}

// ── requestBack clears a pending close-all intent ──────────────────────
{
  const store = createDialogShellStore();
  const closeCalls = { count: 0 };
  const { entry: s1 } = makeEntry({
    id: "s1",
    role: "stacked",
    onClose: () => {
      closeCalls.count += 1;
    },
  });
  store.register(s1);

  store.requestCloseAll();
  assert.equal(closeCalls.count, 1);

  // Without requestBack, a second requestCloseAll here would be suppressed
  // (see the case above). requestBack supersedes the pending intent instead.
  store.requestBack();
  assert.equal(closeCalls.count, 2, "requestBack re-invokes onClose on the top entry");

  store.requestCloseAll();
  assert.equal(
    closeCalls.count,
    3,
    "requestBack cleared pendingCloseAllId, so requestCloseAll is not suppressed immediately after",
  );
}

// ── unregister -> settleExit ────────────────────────────────────────────
{
  const store = createDialogShellStore();
  const { entry: s1 } = makeEntry({ id: "s1", role: "stacked" });
  store.register(s1);
  assert.equal(store.isExiting("s1"), false);

  store.unregister("s1");
  assert.equal(store.isExiting("s1"), true, "unregister marks the entry exiting rather than removing it");
  assert.equal(store.getState().length, 1, "the exiting entry stays in state for the exit animation");

  store.settleExit("s1");
  assert.equal(store.getState().length, 0, "settleExit is what actually removes the entry");
}

// ── forceCloseStacked drops a pending close-all intent it invalidates ──
{
  const store = createDialogShellStore();
  const guardCalls = { count: 0 };
  const { entry: s1 } = makeEntry({
    id: "s1",
    role: "stacked",
    onClose: () => {
      guardCalls.count += 1;
    },
  });
  store.register(s1);

  store.requestCloseAll();
  assert.equal(guardCalls.count, 1, "s1's guarded onClose fires but never unregisters");

  // Registering a base entry force-closes s1 — the very entry the pending
  // close-all intent was waiting on. Without the fix, this wedges
  // requestCloseAll shut for the rest of the session.
  const { entry: b1 } = makeEntry({ id: "b1", role: "base" });
  store.register(b1);
  assert.deepEqual(store.getState().map((e) => e.id), ["b1"]);

  const { entry: s2 } = makeEntry({
    id: "s2",
    role: "stacked",
    onClose: () => store.unregister("s2"),
  });
  store.register(s2);
  store.requestCloseAll();
  assert.deepEqual(
    store.getState().map((e) => e.status),
    ["active", "exiting"],
    "requestCloseAll works again immediately — the stale pending intent did not wedge the store",
  );
}

console.log("all @mydaogs/ui regression assertions passed");
