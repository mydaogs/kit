# [ARCH] - Query Error Boundary

## Description

`QueryErrorBoundary` wraps client query errors with reset support and a fallback UI that can redirect on auth errors

## Behavior

- Uses `QueryErrorResetBoundary` for reset and refetch
- Detects unauthorized errors (via `AppBusinessError.code === "UNAUTHORIZED"`) and navigates to sign-in after a brief delay
- Fallback UI shows a retry button and error details in dev

## Related files

- `<monorepo>/apps/app/src/components/ErrorBoundaries/QueryErrorBoundary.tsx`
- `<monorepo>/apps/app/src/components/AppProviders/AppProviders.tsx`
- `<monorepo>/packages/ui/src/components/StatusCard/StatusCard.tsx`
