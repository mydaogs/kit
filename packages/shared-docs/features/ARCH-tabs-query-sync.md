# [ARCH] - Tabs Query Sync

## Description

Deep-linkable, reload-safe tab state for page and modal surfaces. Tab selections are encoded as URL query params so that the active tab survives refreshes, can be shared as a link, and is preserved across soft-navigation and modal open/close cycles

Multiple independent tab sections can coexist on a single page because each section has its own unique, registered URL param key

## Implementation Details

**Registry (`TAB_SECTIONS`):**

`apps/app/src/lib/tabs/tabSections.ts` — a two-level nested `as const` object, accessed via dot notation (`TAB_SECTIONS.home.featured`). Every leaf has three fields:

```ts
{
  paramKey: string;   // verbose, globally-unique URL key e.g. "homeFeaturedTab"
  values: readonly string[];
  defaultValue: string;
}
```

Param keys are intentionally verbose to avoid collisions and must not overlap with the reserved navigation params. Maintain that reserved list next to the registry

**Hook (`useTabsQueryParams`):**

A thin wrapper over `useUrlQueryParam`, same pattern as the filter and ordering wrappers. Key behaviors:

- `removeIfDefault: false` — the param is always written, including when the tab matches the default. This seeds the param on first load so the URL always shows the active tab
- Canonicalize effect: reads `window.location.search` and calls `setValue(value)` whenever the resolved `value` changes. Fires on mount and also when `availableValues` narrows mid-session, so the URL is immediately rewritten to the resolved fallback rather than lagging behind the UI. Covers missing param (first visit), invalid param (crafted URL), and currently-unavailable param (conditional tabs). Uses `replaceState` so Back-history is unchanged; a `raw !== value` guard prevents loops
- Conditional-tabs override: caller passes `availableValues` to narrow the allowed set. Values outside that set resolve to `defaultValue`
- Returns `{ value, onValueChange, resetValue }`

**Wrapper component (`UrlTabs`):**

Renders the shared `<Tabs>` in controlled mode, driven by `useTabsQueryParams`. Omits `value` and `defaultValue` from props; caller passes `section` and optionally `availableValues`. Composes any consumer `onValueChange` after URL sync

**URL behavior:**

- Always writes the param (never removes on default) — so the slug is always present in the URL after first mount
- Tab switches use `replaceState` (no new history entry)
- Canonicalization uses `replaceState` — existing hash and unrelated params are preserved
- Return-path snapshots are unaffected, since tab slugs are not reserved params and link helpers preserve all other params

## Registered sections

Maintain a table of registered sections with `paramKey`, values, and default, so collisions are visible in review

## Related files

- `<monorepo>/apps/app/src/lib/tabs/tabSections.ts` - Section registry
- `<monorepo>/apps/app/src/lib/hooks/useTabsQueryParams.ts` - URL-sync hook
- `<monorepo>/apps/app/src/components/UrlTabs/UrlTabs.tsx` - Controlled Tabs wrapper
- `<monorepo>/apps/app/src/lib/hooks/useUrlQueryParam.ts` - Underlying URL param primitive
- `rules/tabs-query-param-rules.md`
