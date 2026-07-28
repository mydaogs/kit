# Form Rules

## Description

These rules define the default implementation pattern for forms

## When to use

- Creating a new user-input form
- Refactoring existing form code for consistency
- Reviewing form-related pull requests

## When NOT to use

- URL-driven filter controls where URL params are the source of truth and no submit mutation is performed
- Pure display components with no editable inputs

## Rules

- Use `react-hook-form` with `zodResolver` for client form state and validation
- Define or reuse a Zod schema from `<monorepo>/apps/app/src/lib/schemas/*` and infer form types from that schema
- Use shared form primitives from `@shared/ui/components/form` (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) instead of custom ad-hoc wrappers
- Use shared field components (`Input`, `Textarea`, `Checkbox`, `RadioGroup`, etc.) from `@shared/ui/components/*`
- Every editable control must have an associated label; never rely on placeholders alone
- Inside `FormField` `render={({ field }) => ...}`, prefer `<FormLabel>` for labelable controls and wrap the control with `<FormControl>` so id/aria wiring is automatic; avoid manual `htmlFor` and manual `id` unless a component requires it
- Use `<Label>` for non-`FormField` forms and for option labels (`RadioGroupItem`, checkbox options) that target explicit option ids
- For grouped controls (radio/checkbox sets), use `<fieldset>` + `<legend>` for the group label and keep per-option labels bound to their option ids
- Keep group-label visuals aligned with label primitives by styling `<legend>` with label-typography classes
- For custom file/dropzone flows, `react-hook-form` `Controller` is allowed when native `FormField` wiring is not practical
- Submit offchain mutations through Next.js server actions from `<monorepo>/apps/app/src/actions/*` instead of client `fetch` from the form component
- Validate server-action form payloads with Zod (`safeParse`) before calling mutation functions
- Server component forms may use native `<form action={serverAction}>` for simple progressive-enhancement submit flows
- For onchain writes, use the established web3 hooks pattern and still keep local form state/validation with `react-hook-form` + Zod
- Do not wrap submit mutations in `startTransition(async () => ...)`; React transition pending does not guarantee tracking of async request completion
- Manage pending submission state with explicit async lifecycle (`useState` + `try/finally`, or an equivalent async hook state) and guard against re-entry while pending
- Render loading/disabled states from that explicit pending flag via `LoadingButton` or `Web3ConnectBtn`
- Use `FormMessage` for field-level validation errors and `ErrorBlock` / `SuccessBlock` or toast feedback for submit result
- Keep all user-facing labels, placeholders, and status text in `next-intl` message keys, synced across locale files
- Reset transient submit state (error/success) when inputs change so feedback reflects the current attempt

## Examples

- Preferred submit flow
  - Define Zod schema in `src/lib/schemas`
  - Initialize `useForm` with `zodResolver(schema)`
  - Render controls through `FormField` + shared input components
  - Call a server action in `onSubmit`
  - Set `isSubmitting=true` before `await` and reset in `finally`
  - Ignore repeated submits while `isSubmitting` is `true`
  - Show pending state through `LoadingButton isLoading`
