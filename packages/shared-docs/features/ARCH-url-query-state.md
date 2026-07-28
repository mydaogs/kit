# [ARCH] - URL Query State

## Description

URL-based state management hooks for managing application state via URL query parameters. Provides type-safe parameter management with validation, default values, and optional cleanup when values match defaults. Enables shareable/bookmarkable application state

## Implementation Details

**Core hook pattern:**

```typescript
const { value, setValue, resetValue } = useUrlQueryParam({
  paramKey: "filter",
  allowedValues: ["all", "draft", "active"] as const,
  defaultValue: "all",
  removeIfDefault: true,
});
```

**Key features:**

- Type-safe parameter management with allowed values
- Custom validator function support
- Automatic URL updates without losing other params
- Optional removal of param when set to default value
- Validates URL params against allowed values or custom validator
- Returns to default if an invalid value is found in the URL
- Optional opt-in persistence of the last value to local storage, so a filter can be restored on a later visit

**Specialized wrappers:**

- `useUrlQueryFilters` — filter parameters with standard filter types and defaults
- `useUrlQueryOrderBy` — paired ordering params with validated sort keys and direction toggles
- `useUrlQueryParam`-based `useTabsQueryParams` — deep-linkable tab sections, always writing the param (no `removeIfDefault`) and canonicalizing on mount. See `ARCH-tabs-query-sync.md`

**Implementation:**

- Uses Next.js `usePathname` and `useSearchParams`
- Merges into the existing search params rather than replacing them
- URL writers that merge query params must build mutable params from `window.location.search` at write time. This prevents a stale `useSearchParams()` snapshot from reintroducing already-consumed one-time params when another effect writes the URL later in the same mount

## Related files

- `<monorepo>/apps/app/src/lib/hooks/useUrlQueryParam.ts` - Core hook
- `<monorepo>/apps/app/src/lib/hooks/useUrlQueryFilters.ts` - Filter-specific wrapper
- `<monorepo>/apps/app/src/lib/hooks/useUrlQueryOrderBy.ts` - Ordering wrapper
- `<monorepo>/apps/app/src/lib/hooks/useTabsQueryParams.ts` - Tab-section wrapper
- `<monorepo>/apps/app/src/lib/utils/updateQueryParams.ts` - `replaceState` utility
