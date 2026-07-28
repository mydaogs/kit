# Tab Query Param Rules

## Rules

- Use `UrlTabs` (or `useTabsQueryParams` directly) for any tab section that must be deep-linkable or survive navigation. Do not reach for local `useState` for tab state when the tab should be bookmarkable
- Every independent tab section must have a unique registered slug in `TAB_SECTIONS` (`apps/app/src/lib/tabs/tabSections.ts`). Slugs are verbose, fully-namespaced URL keys (e.g. `organizationSettingsTab`, not `tab` or `orgTab`) to guarantee global uniqueness and prevent collision between sections that coexist on the same page
- Multiple independent tab sections on one page are supported: each section has its own `paramKey`, so all sections can be encoded simultaneously in the URL
- Do not use any reserved navigation param name as a tab slug. Maintain the reserved list alongside the registry; typical reserved names are `returnTo`, `modalReturnTo`, `next`, `toast`, `authError`, `view`, `orderByKey`, `orderByDir`
- For conditional tabs (tabs that may not always be rendered or available), pass `availableValues` to `UrlTabs` or `useTabsQueryParams`. A crafted URL pointing at an unavailable tab value falls back to the section's `defaultValue` instead of rendering an empty surface
- Do not URL-sync tabs whose container is local state (e.g. a tab inside a locally-opened dialog that cannot be reopened by URL alone). The param would restore the tab selection but not reopen the dialog

## When to use `UrlTabs` vs `useTabsQueryParams` directly

- Use `<UrlTabs section={...}>` for all standard tab sections — it handles the controlled `<Tabs>` wiring automatically
- Use `useTabsQueryParams(section)` directly only when the active tab value must drive additional component logic beyond the `<Tabs>` root itself (e.g. a CTA href or a sibling element that depends on which tab is active). In that case, feed both `<Tabs value={...} onValueChange={...}>` and the extra logic from the hook's `value`

## Examples

```tsx
// Simple case — UrlTabs wrapper
<UrlTabs section={TAB_SECTIONS.settings.profile}>
  <TabsList>...</TabsList>
  <TabsContent value="details">...</TabsContent>
  <TabsContent value="privacy">...</TabsContent>
</UrlTabs>

// Conditional tabs — exclude unavailable values
<UrlTabs
  section={TAB_SECTIONS.settings.organization}
  availableValues={
    isOwner ? undefined : (["details", "logo"] as const)
  }
>
  ...
</UrlTabs>

// Direct hook — value also drives external logic outside the Tabs root
const { value, onValueChange } = useTabsQueryParams(TAB_SECTIONS.home.featured);
const ctaHref = value === "recent" ? "/list?filter=recent" : "/list";
<Tabs value={value} onValueChange={onValueChange}>...</Tabs>
```

## Related

- `apps/app/src/lib/tabs/tabSections.ts` — the canonical section registry
- `apps/app/src/lib/hooks/useTabsQueryParams.ts` — hook implementation
- `apps/app/src/components/UrlTabs/UrlTabs.tsx` — wrapper component
- `features/ARCH-tabs-query-sync.md` — architecture overview
