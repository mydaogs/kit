export type DialogShellType = "normal" | "dangerous";
export type DialogShellRole = "base" | "stacked";
export type DialogShellEntryStatus = "active" | "exiting";

export interface DialogShellRegisterEntry {
  id: string;
  role: DialogShellRole;
  shellType: DialogShellType;
  title: string;
  className?: string;
  baseKey?: string;
  preventDialogOutsideInteraction: boolean;
  container: HTMLElement;
  backContainer: HTMLElement | null;
  onClose: () => void;
  onInvalidate: () => void;
}

export type DialogShellUpdatePatch = Partial<
  Pick<
    DialogShellRegisterEntry,
    | "shellType"
    | "title"
    | "className"
    | "baseKey"
    | "preventDialogOutsideInteraction"
    | "backContainer"
    | "onClose"
  >
>;

export interface DialogShellEntry extends DialogShellRegisterEntry {
  status: DialogShellEntryStatus;
}

export interface DialogShellStackEntryView {
  id: string;
  container: HTMLElement;
  backContainer: HTMLElement | null;
  state: "active" | "covered" | "exiting";
}

export interface DialogShellStackViewProps {
  entries: readonly DialogShellStackEntryView[];
  onEntryExitComplete: (id: string) => void;
}

export interface DialogShellApi {
  register: (entry: DialogShellRegisterEntry) => void;
  update: (id: string, patch: DialogShellUpdatePatch) => void;
  unregister: (id: string) => void;
  settleExit: (id: string) => void;
  requestBack: () => void;
  requestCloseAll: () => void;
  isExiting: (id: string) => boolean;
  subscribe: (callback: () => void) => () => void;
  getState: () => readonly DialogShellEntry[];
}

// Every `update()` call site (the `DialogDrawer` registrar) always passes a
// full patch object every time, so an `undefined` value is a real "clear
// this field" request, not "leave it alone" — compare it like any other
// value instead of special-casing it away.
const shallowPatchChanged = (
  current: DialogShellEntry,
  patch: DialogShellUpdatePatch,
) =>
  (Object.keys(patch) as (keyof DialogShellUpdatePatch)[]).some(
    (key) => patch[key] !== current[key],
  );

// Grace window for `requestCloseAll`'s acknowledgment chain: long enough to
// cover a genuine accept's render-commit-then-effect-cleanup flush (which,
// for every real `onClose` in this codebase, is a synchronous `setState`
// resolved well within a single task), short enough that a guarded refusal
// (`if (isSubmitting) return`, no commit at all) aborts quickly instead of
// wedging the shell shut.
const CLOSE_ALL_ACK_TIMEOUT_MS = 300;

export const createDialogShellStore = (): DialogShellApi => {
  let entries: DialogShellEntry[] = [];
  const listeners = new Set<() => void>();
  let pendingCloseAllId: string | null = null;
  let pendingCloseAllToken = 0;

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const liveEntries = () =>
    entries.filter((entry) => entry.status === "active");

  // Invokes `onClose` on `id` and arms a timeout that aborts the pending
  // close-all intent if no unregistration ever arrives for it — the only
  // signal a silently-refused (guarded) `onClose` ever produces is silence.
  const beginPendingClose = (id: string) => {
    pendingCloseAllId = id;
    pendingCloseAllToken += 1;
    const token = pendingCloseAllToken;

    setTimeout(() => {
      if (pendingCloseAllToken !== token || pendingCloseAllId !== id) return;
      pendingCloseAllId = null;
    }, CLOSE_ALL_ACK_TIMEOUT_MS);
  };

  const forceCloseStacked = () => {
    const toClose = entries.filter(
      (entry) => entry.role === "stacked" && entry.status === "active",
    );
    if (!toClose.length) return;

    const toCloseIds = new Set(toClose.map((entry) => entry.id));
    // A force-close can remove the entry a close-all chain is waiting on;
    // nothing will ever unregister it now, so the pending intent must be
    // dropped here or it wedges `requestCloseAll` shut for the rest of the
    // session.
    if (pendingCloseAllId !== null && toCloseIds.has(pendingCloseAllId)) {
      pendingCloseAllId = null;
    }
    entries = entries.filter((entry) => !toCloseIds.has(entry.id));
    emit();
    toClose.forEach((entry) => {
      entry.onInvalidate();
      entry.onClose();
    });
  };

  const register: DialogShellApi["register"] = (entry) => {
    if (
      process.env.NODE_ENV !== "production" &&
      entry.role === "base" &&
      entries.some((e) => e.role === "base" && e.id !== entry.id)
    ) {
      console.error(
        '[DialogShell] A second role="base" DialogDrawer registered while one was already active. Only one base entry (typically InterceptedDialogDrawer) is supported at a time; the new one replaces it.',
      );
    }

    const newEntry: DialogShellEntry = { ...entry, status: "active" };
    const withoutExisting = entries.filter((e) => e.id !== entry.id);

    entries =
      entry.role === "base"
        ? [newEntry, ...withoutExisting]
        : [...withoutExisting, newEntry];
    emit();

    if (entry.role === "base") {
      forceCloseStacked();
    }
  };

  const update: DialogShellApi["update"] = (id, patch) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) return;

    const current = entries[index]!;
    if (!shallowPatchChanged(current, patch)) return;

    const merged: DialogShellEntry = { ...current, ...patch };
    const baseKeyChanged =
      current.role === "base" &&
      patch.baseKey !== undefined &&
      patch.baseKey !== current.baseKey;

    entries = entries.map((entry, i) => (i === index ? merged : entry));
    emit();

    if (baseKeyChanged) {
      forceCloseStacked();
    }
  };

  const unregister: DialogShellApi["unregister"] = (id) => {
    const index = entries.findIndex(
      (entry) => entry.id === id && entry.status === "active",
    );
    if (index === -1) return;

    entries = entries.map((entry, i) =>
      i === index ? { ...entry, status: "exiting" } : entry,
    );
    emit();

    if (pendingCloseAllId === id) {
      pendingCloseAllId = null;
      const nextTop = liveEntries().at(-1) ?? null;
      if (nextTop) {
        beginPendingClose(nextTop.id);
        nextTop.onClose();
      }
    }
  };

  const settleExit: DialogShellApi["settleExit"] = (id) => {
    if (!entries.some((entry) => entry.id === id)) return;
    entries = entries.filter((entry) => entry.id !== id);
    emit();
  };

  const requestBack: DialogShellApi["requestBack"] = () => {
    // A direct back-affordance click is a fresh, explicit intent — it
    // supersedes (and clears) any close-all chain still waiting on an ack,
    // rather than re-invoking `onClose` on whatever that chain was pending.
    pendingCloseAllId = null;
    const top = liveEntries().at(-1) ?? null;
    top?.onClose();
  };

  const requestCloseAll: DialogShellApi["requestCloseAll"] = () => {
    if (pendingCloseAllId !== null) return;
    const top = liveEntries().at(-1) ?? null;
    if (!top) return;

    beginPendingClose(top.id);
    top.onClose();
  };

  const isExiting: DialogShellApi["isExiting"] = (id) =>
    entries.find((entry) => entry.id === id)?.status === "exiting";

  const subscribe: DialogShellApi["subscribe"] = (callback) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };

  const getState: DialogShellApi["getState"] = () => entries;

  return {
    register,
    update,
    unregister,
    settleExit,
    requestBack,
    requestCloseAll,
    isExiting,
    subscribe,
    getState,
  };
};
