# [ARCH] - React Hook Form Integration

## Description

Forms use react-hook-form with `zodResolver` for type-safe validation and shared UI form components

## Behavior

- Schemas live in `lib/schemas`
- Forms submit to server actions and show toast feedback
- Pending state is tracked with an explicit async lifecycle, not `useTransition` — a React transition's pending flag does not reliably track async request completion
- Draft-oriented forms use `useDebouncedAutosave` with a projected partial schema when persistence should happen after idle input. It validates before saving, serializes requests, retries transient failures, and allows terminal actions to cancel their pending save

## Related files

- `<monorepo>/packages/ui/src/components/form.tsx`
- `<monorepo>/apps/app/src/lib/hooks/useDebouncedAutosave.ts`
- `<monorepo>/apps/app/src/lib/schemas`
- `rules/forms-rules.md`
