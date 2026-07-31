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
| `react-hook-form` | optional | only needed to use the `Form*` components from `@mydaogs/ui/client` |

## Entry points

- `@mydaogs/ui` — RSC-safe primitives and composites with no client directive, importable from a server component
- `@mydaogs/ui/client` — interactive primitives and composites, bundled with a `"use client"` banner
- `@mydaogs/ui/next` — modules that depend on `next` (`next/image`, `next/link`, `next/navigation`)
- `@mydaogs/ui/styles.css` — the Tailwind v4 stylesheet

The `.` and `./client` barrels are disjoint — each export lives in exactly one of them, matching whether the underlying component needs client interactivity. Importing a client-only export from `.` (or vice versa) is a type error, not a silent misroute.

`./client` and `./next` reach shared RSC-safe primitives (`Button`, `cn`, …) through the package's own `@mydaogs/ui` specifier rather than duplicating them, so `Button`'s implementation ships once regardless of how many entry points use it.

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
