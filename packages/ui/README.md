# @mydaogs/ui

shadcn-style React primitives and composites: Radix-backed components, RSC-safe by default, with a Tailwind v4 stylesheet that self-registers its own source scan.

## Install

```bash
npm install @mydaogs/ui
```

## Peer dependencies

| Peer | Required | Notes |
| --- | --- | --- |
| `react`, `react-dom` | yes | `^18` or `^19` |
| `next` | optional | only needed to use `@mydaogs/ui/next` (`AppImage`, `AppImagePreview*`, `createCrossAppLink`, `FooterShell`) |
| `react-hook-form` | optional | only needed to use `@mydaogs/ui/form` |

`Combobox`'s `validationSchema` prop (`@mydaogs/ui/client`) takes anything implementing a minimal `safeParse` shape — any zod schema satisfies it, but the package carries no zod dependency of its own at any version.

## Entry points

- `@mydaogs/ui` — RSC-safe primitives and composites with no client directive, importable from a server component
- `@mydaogs/ui/client` — interactive primitives and composites, bundled with a `"use client"` banner
- `@mydaogs/ui/next` — modules that depend on `next` (`next/image`, `next/link`, `next/navigation`)
- `@mydaogs/ui/form` — `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormDescription`/`FormMessage`/`useFormField` and `DatePicker` (which renders inside `FormControl`). Kept out of `./client` deliberately: `react-hook-form` is an optional peer, and a single bundled entry evaluates every top-level import when loaded — folding `Form` into `./client` would make `react-hook-form` a hard requirement for anyone using anything from `./client` at all, not just forms
- `@mydaogs/ui/styles.css` — the Tailwind v4 stylesheet

The `.`, `./client`, and `./form` barrels are disjoint — each export lives in exactly one of them, matching whether the underlying component needs client interactivity or react-hook-form. Importing a client-only or form-only export from the wrong entry is a type error, not a silent misroute.

`./client`, `./next`, and `./form` reach primitives owned by a different entry (`Button`, `Card`, `Calendar`, `Popover`, …) through the package's own bare specifiers (`@mydaogs/ui`, `@mydaogs/ui/client`, …) rather than duplicating them, so each primitive's implementation ships once regardless of how many entry points use it. `cn` is the one deliberate exception — it's small and stateless enough that a few duplicate copies across entries cost nothing, so it's imported directly rather than threaded through self-references everywhere.

## Tailwind setup

`styles.css` self-registers its own compiled output as a Tailwind `@source` and does not declare `@import "tailwindcss"` itself — the consuming app owns the Tailwind entry:

```css
/* app/globals.css */
@import "tailwindcss";
@import "@mydaogs/ui/styles.css";
```

See [`theming.md`](./theming.md) for the full token contract the stylesheet expects the app to define.

## Dialog shell

`DialogShellProvider` / `DialogDrawer` (`@mydaogs/ui/client`) route every dialog and drawer in the app through a single host, so nested and sequential dialogs stack instead of portaling separate overlays. See [`dialog-shell.md`](./dialog-shell.md) for the stack model and close-acknowledgment behavior.

## i18n

The package has no i18n setup of its own. A handful of components accept label props with English defaults instead of reading translations directly — pass a translated string from the consuming app's i18n library:

- `StatusCardLoading`: `label`
- `InfoCardAccordion`: `expandLabel`, `collapseLabel`
- `Combobox`: `labels.clear`
- `AppImage`: `loadingLabel`
- `DialogShellProvider`: `backLabel`
- `createCrossAppLink`: takes a `useLocale` hook so the factory stays i18n-library-agnostic
