# ARCH - Toast Lifecycle Controls

A shared toast wrapper in `@shared/ui` exposes three toast lifecycle modes behind the plain `toast.*` call signature

## Overview

- Default `toast(...)`, `toast.success(...)`, `toast.error(...)`, and `toast.info(...)` toasts are auto-dismissed and render the close button
- Passing `duration: Infinity` keeps a toast visible until the user dismisses it or the app calls `toast.dismiss(...)`
- Passing `id` gives the toast library a stable identity so a later call updates the existing toast in place; transaction lifecycle toasts keep one id through route handoff and phase changes, then advance an in-memory generation after dismissal so a quick recreate cannot inherit a toast already marked for deletion
- Persistent guard prompts use the same stable-ID plus generation pattern through `useGuardToastLifecycle`; eligible rerenders update in place, actual dismissal advances only the matching current generation, and acquiring the next generation reissues dismissal of the previous ID to heal disrupted deferred delivery
- `dismissible: false` disables the close button and also prevents action content from auto-dismissing the toast
- The X button renders through the library's native `cancel` action, whose handler removes the toast component-locally instead of going through the deferred global dismissal chain that route transitions can disrupt
- Id-scoped programmatic dismissal reissues the dismiss once after a short delay as best-effort healing for disrupted deferred delivery; the no-id dismiss-all variant is never retried because it could hit unrelated newer toasts
- `dismissOnAction` keeps the default action-click dismissal behavior unless explicitly turned off
- `toast.loading(title, optionsOrOnDismiss?)` is persistent and accepts either the shared toast options (including `id`) or a bare dismiss callback, for pending workflows
- The `toast.loading` dismiss callback fires only for wrapper-controlled user dismissal, such as the X button. It does not fire for programmatic `toast.dismiss(id)`. Non-dismissible toasts have no user-dismiss path
- Programmatic dismissal still works through `toast.dismiss(...)` even when normal user dismissal is disabled

## How it works

- A private `createToast(variant, title, options)` helper forwards `id`, `duration`, and `dismissible` into the library's `custom(...)` renderer
- Dismissible toasts get a `cancel` action styled as the X button; the wrapper `onDismiss` callback is scheduled in a microtask from `cancel.onClick` so a throwing callback cannot block removal, and it stays off the library's option-level `onDismiss`, which would also fire for programmatic dismissal and incorrectly snooze guards
- Action content only dismisses the toast when `dismissible !== false` and `dismissOnAction !== false`

## Host and mounting

A root layout that wraps app content in a `contain: layout paint` container establishes a stacking context, which would trap any toaster rendered inside it below dialog overlays portaled to `document.body`

To avoid this, the toaster is rendered as a **direct sibling** of the contain div — outside the stacking context — so its high `z-index` resolves in the body root and wins over the dialog overlay

The effects component that runs URL/auth-error hooks and mounts the pending-transaction watcher is mounted inside the providers, because those hooks require provider context. It does not render the toaster itself

## Related files

- `<monorepo>/packages/ui/src/components/sonner.tsx`
- `<monorepo>/apps/app/src/app/layout.tsx`
- `<monorepo>/apps/app/src/components/AppProviders/AppToastEffects.tsx`
- `<monorepo>/apps/app/src/lib/hooks/useGuardToastLifecycle.ts`
