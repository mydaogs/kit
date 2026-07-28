# PPR postponed-state invariant and param-independent dynamic routes

## Context

With `cacheComponents: true` under Cache Components / PPR, a dynamic App Router page that `await`s `params` server-side produces a per-request postponed render: the page prerenders a fallback shell, then resumes with the real params once they are known. When a POST (Server Action) request hits a URL Next has not already cached a full render for, the resume path can carry both a `postponed` render state and a non-empty `fallbackRouteParams` set at the same time. Next's router throws:

```
InvariantError: postponed state should not be provided when fallback params are provided
```

The request never completes: the Server Action's mutation is lost from the caller's point of view (no response, no error surfaced to the user), even though the mutation itself may have committed server-side

## Root cause

The trigger is a dynamic-segment page (`[id]`, `[slug]`, …) that reads its route param on the server — `await params` in the page component, or any server-side code path derived from it. That server-side dependency is what makes the page's prerender param-dependent, which is what produces `fallbackRouteParams` on a not-yet-cached resume. A page that never reads `params` server-side has nothing to postpone on that axis and fully prerenders

This is **not fixable from application code once the page already awaits params server-side** — no `Suspense` boundary, `generateStaticParams`, or per-route `dynamic` export inside the page avoids the interaction between postponed state and fallback params. The only application-level fix is to stop the page from depending on the param on the server at all

Treat it as open — not resolved by a later `next` bump — until independently reverified

## Rule going forward

**Dynamic route pages under `cacheComponents: true` must be param-independent on the server.** A `page.tsx` for a `[param]` segment must not `await params` (or otherwise depend on the param server-side) unless the page has an unrelated, unavoidable server-side need that is not itself param-derived. Read the param client-side instead, inside a client component

## Sanctioned workaround

- `useLatchedRouteParam(name)` reads one dynamic segment via `useParams()` client-side and latches the last committed string value in an effect-backed ref, so callers see `undefined` only until the first value is observed — including across an intercepted-modal closing snapshot re-render, where render-phase params can already have changed but the latch still returns the last committed value
- Affected route widgets follow a wrapper pattern: the exported component reads the param with `useLatchedRouteParam`, renders `StatusCardLoading` while it is `undefined`, and otherwise renders an inner `...Inner` component that receives the param as a plain prop. Where a hydration-guard layer already owns the `...Inner` name, the inner component is `...Body` instead
- The route's `page.tsx` is sync and just returns the widget
- A page may stay `async` only for a server-side need unrelated to the route param (for example `getTranslations`), which does not reintroduce param-dependence

## `@shared/ui` navigation type shim

A shared UI package that carries an ambient `declare module "next/navigation"` shim shadows the real Next.js types for **every** consumer. It must therefore declare every API those consumers use — `useParams` included, since the pattern above depends on it. Any addition to this shim must be checked against the real `next/navigation` surface: a shim that shadows real types silently hides new or updated APIs from consumers

## Related files

- `<monorepo>/apps/app/src/lib/hooks/useLatchedRouteParam.ts`
- `<monorepo>/packages/ui/next.d.ts`
- `<monorepo>/apps/app/next.config.mjs`
- `nextjs-runtime-and-cache-components.md`
