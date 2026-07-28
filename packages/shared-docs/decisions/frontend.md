# Frontend Architecture

The main product UI lives in `<monorepo>/apps/app` and is built with Next.js App Router (React server-first)

## Rendering Model

- For data fetching flow see `data-flow.md`
- Use guards to enforce role-based access at different levels of navigation

## State, Forms, Validation

- **TanStack Query** for client-side caching, invalidation, and async state
- **react-hook-form + Zod** for form state and validation schemas

## UI System

- Shared UI components in `<monorepo>/packages/ui` (shadcn/ui + Tailwind)
- Reusable code structure with shared code in monorepo packages and app source
- Shared cross-app UI contexts live in `<monorepo>/packages/ui/src/components/<feature>/` alongside the reusable component family that owns them, and are mounted by each app at layout time

## Internationalization

- `next-intl` for locale routing and translated content
- Locale is stored as a user preference and also used as a public build-time/runtime setting when each language version is built and deployed as a separate app

## URL-Synced Tab State

Tab state for deep-linkable sections is managed through a registered section registry (`TAB_SECTIONS` in `apps/app/src/lib/tabs/tabSections.ts`) rather than ad-hoc `useState`. Key contract decisions:

- **Nested registry, dot notation access** — sections are grouped by page area (`TAB_SECTIONS.home.featured`). This grouping is the approved API surface; flat or renamed registries would break all call sites
- **Verbose, globally-unique URL param keys** — each section's `paramKey` is fully-namespaced (e.g. `organizationSettingsTab`) to guarantee global uniqueness and prevent collision when multiple sections coexist on one page. Short names like `tab` or `orgTab` are not acceptable
- **Always-write, no `removeIfDefault`** — tab params are always written to the URL, including when the value equals the default. This ensures the tab slug is always visible in the URL for discoverability and debugging
- **Mount canonicalization via `replaceState`** — on mount, `useTabsQueryParams` rewrites the URL to the resolved value if the raw param is missing, invalid, or currently unavailable. Uses `replaceState` so Back-history is not polluted
- **Conditional tabs via `availableValues`** — when a tab is conditionally available, callers pass `availableValues` to narrow the allowed set. Crafted URLs pointing at unavailable values canonicalize to the default rather than rendering an empty surface
- **Reserved params must not be used as tab slugs** — navigation and filter systems reserve their own param names; maintain that list next to the registry
- **`packages/ui` boundary** — `tabs.tsx` in `@shared/ui` is generic; URL-sync logic lives entirely in the app (`useTabsQueryParams` hook + `UrlTabs` wrapper). Shared UI packages must not import app hooks

See `features/ARCH-tabs-query-sync.md` for implementation details and `rules/tabs-query-param-rules.md` for usage rules

## Navigation prefetching

Links whose destination encodes the current route in `returnTo`-style params default to `prefetch={false}`, because prefetched RSC payloads are non-reusable across navigation contexts. Modal navigation retains its loading boundary so on-demand requests have visible feedback

## Pending transaction session and browser-tab lifecycle

Pending blockchain reconciliation records persist independently of the TanStack Query persister. Each transaction is stored as a strict v1 record under its own `tx_sync:<hash>` localStorage key with a non-empty action scope and required action identity. Per-hash storage is required because whole-object read-modify-write cannot safely merge simultaneous completions from different browser tabs. The persisted TanStack Query cache carries a buster so an incompatible cached shape is discarded rather than restored

Receipt polling and reconciliation require a per-hash Web Lock. The submitting hook acquires the lock before publishing the durable entry, while root-mounted recovery watchers queue without polling or rendering a duplicate toast. Closing or navigating away from the live owner releases the lock for automatic takeover. Durable completion settlement requires current ownership and a current record but may finish after watcher unmount; session invalidation and toast effects additionally require the watcher to remain mounted. Hash-plus-generation toast ids update pending/reconciling copy in place and rotate only after an explicit dismiss

Watchers wait for the initial authoritative session result and stay mounted during routine background session refetches. Signed-out state preserves records and retry counts for a later sign-in. A 401 pauses work and refreshes session authority without consuming a retry; network, rate-limit, and indexer-in-progress failures retry at most five times; all other failures move the retained record to a visible warning state. This keeps optimistic state inspectable without an unbounded background loop
