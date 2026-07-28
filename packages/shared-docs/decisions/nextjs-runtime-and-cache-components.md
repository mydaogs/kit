# Next.js runtime and Cache Components

## Decision

Web apps run Next.js on a **stable release line** with Cache Components enabled at the config root, Turbopack as the bundler, and the React Compiler on

- Pin `next` to a caret range on the current stable minor in every app and in `packages/ui`'s devDependency; exact-pin only where a dependency declares a narrow supported range
- Do not pin a canary. Turbopack over-traces a pnpm workspace through a generated Prisma client's dynamic `process.cwd()` access, producing a serverless bundle with symlinked directories that managed hosts reject, and a prerelease does not satisfy the stable-oriented peer ranges of common ecosystem packages under default semver

## Configuration

- `cacheComponents` sits at the top level of each app config
- Define a named `cacheLife` profile per read class rather than passing ad-hoc durations, and keep every declared profile in use
- Turbopack rules cover SVG imports, browser fallbacks, and server-only externals
- ESLint uses the Next flat config path through `@next/eslint-plugin-next`
- Dynamic App Router pages type props with the `PageProps<'/route'>` route helpers, not ad hoc `Promise<{...}>` types
- Server Actions use `updateTag()` for read-your-own-writes flows, and `refresh()` only when the router genuinely needs a post-mutation refresh
- Static generation of CMS-backed content combines `generateStaticParams` with data fetching and `"use cache"`

## Tracking framework defects

Keep a section here for framework bugs the app currently works around. Each entry should record the symptom, the mitigation, whether the mitigation is version-independent, and how to verify a candidate release carries the upstream fix — so the workaround can be retired deliberately rather than forgotten

Two recurring classes worth watching on Cache Components:

### Router action-queue interaction

When a navigation preempts an in-flight Server Action, a stranded action can leave the router suspended indefinitely. It surfaces as an infinite spinner where a form navigation, a guard redirect, and a Server Action overlap

**Mitigation shape:** make a single component the sole post-auth navigation owner, so the overlapping-navigation precondition never occurs. This is version-independent and a standalone correctness improvement

### PPR postponed-state invariant

A dynamic page that `await`s `params` server-side can throw `InvariantError: postponed state should not be provided when fallback params are provided` when a Server Action POST resumes an uncached URL, silently losing the mutation

**Mitigation shape:** the param-independent-routes rule plus the `useLatchedRouteParam` + widget-wrapper pattern. Full writeup in `ppr-postponed-state-invariant.md`

## Related files

- `<monorepo>/apps/*/next.config.mjs`
- `<monorepo>/packages/eslint-config/next.js`
- `data-flow.md`
