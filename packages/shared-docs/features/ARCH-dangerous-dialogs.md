# [ARCH] - Dangerous Dialogs

## Description

`DangerousActionDialog` is the app-wide danger-themed confirmation drawer for high-impact actions. It is fully controlled by the parent, does not auto-close on confirm, and can omit the default confirm button when callers supply custom child actions. It also supports a custom confirm label so route-specific destructive flows can keep their own CTA wording while still using the shared dialog shell

It renders through the shared `DialogDrawer` with `shellType="dangerous"` rather than passing danger background classes as a `className`; a single dialog shell host applies that background whenever a `dangerous`-typed entry is topmost, so a danger confirm opened over another local dialog or an intercepted modal swaps the shared shell's background instead of stacking a second portal, and restores the previous background when it is dismissed or popped back from

## Behavior

- Confirm button supports loading and disabled states
- Optional custom content via `children` for richer confirmations
- Optional `confirmLabel` overrides the default confirm CTA
- Default confirm button is rendered only when `onActionConfirm` is provided
- Parent closes the dialog after async work completes
- Callers that guard their `onClose` while a mutation is pending block the shell's acknowledgment-gated close-all chain until the mutation settles, so Esc, outside-click, and X cannot dismiss the dialog mid-submit

## Related files

- `<monorepo>/apps/app/src/components/DangerousActionDialog/DangerousActionDialog.tsx`
- `<monorepo>/packages/ui/src/components/DialogShell/DialogShellHost.tsx`
