# Dialog shell

A single host renders every dialog and drawer in the app, so at most one Radix `Dialog`/Vaul `Drawer` is ever mounted at a time — nested or sequential dialogs stack inside that one host instead of portaling separate overlays.

## Mounting

Mount `DialogShellProvider` once, near the root of the app:

```tsx
import { DialogShellProvider } from "@mydaogs/ui/client";

<DialogShellProvider backLabel="Back">{children}</DialogShellProvider>;
```

`backLabel` is the aria-label for the generic "pop one level" back button shown at stack depth > 1. It defaults to the English string `"Back"` — the package has no i18n setup of its own, so an app using next-intl (or any other i18n library) passes its own translated value instead.

Register a dialog or drawer with `DialogDrawer`:

```tsx
import { DialogDrawer } from "@mydaogs/ui/client";

<DialogDrawer title="Edit profile" isOpen={isOpen} onClose={handleClose}>
  {content}
</DialogDrawer>;
```

`DialogDrawer` renders as a Radix `Dialog` above the `sm` breakpoint and a Vaul `Drawer` below it, switching automatically.

## The stack model

- **`role: "base"`** — at most one at a time. Registering a new base entry force-closes every active `role: "stacked"` entry, and changing a base entry's `baseKey` does the same (a `baseKey` change means the underlying record changed identity, so anything stacked on top of it is no longer valid)
- **`role: "stacked"`** (the default) — any number may be active; the most recently registered is the one shown, with earlier ones covered but not unmounted, so their state survives being covered
- **`requestBack()`** — closes only the top entry and clears any pending close-all intent, so it always wins over a chain already in flight
- **`requestCloseAll()`** — walks the stack top to bottom. It calls the top entry's `onClose`, waits for that entry to unregister (accepting the close), then repeats for the next one down. A `role: "base"` entry force-closing the stack drops any close-all intent that was waiting on an entry it just removed, so a stale intent can never wedge the shell shut

## The close-ack grace window

`onClose` is not guaranteed to actually close anything — a caller can guard it (`if (isSubmitting) return`) to block dismissal mid-mutation. `requestCloseAll` has no other signal for "refused" than silence, so it arms a 300ms timer when it calls an entry's `onClose`: if that entry has not unregistered by the time the timer fires, the pending intent is dropped and a later `requestCloseAll` call is free to try again. A guarded refusal aborts quickly; a genuine accept — which for every real `onClose` resolves within a single synchronous `setState`-then-effect-cleanup flush — completes well inside the window.

## Package boundary

`createDialogShellStore` (the state machine above) has no React import — `DialogShellContext` only holds `createContext`. This keeps the store testable without a DOM and importable from a plain Node script.

`DialogShellHost` and `DialogDrawerFrame` are internal — the single host is rendered once by `DialogShellProvider` and is not part of the public API. Supply a custom `stackView` prop to `DialogShellProvider` for an animated stack transition; the default `DialogShellStackView` settles pops immediately with no exit animation.
