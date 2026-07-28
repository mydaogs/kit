# [ARCH] - Widgets Architecture

## Description

`_widgets` folders group page-specific UI and logic so `page.tsx` files stay thin. Widget subcomponents live under `_widgets/_components`, and page-local types, utils, and hooks live under `_widgets/_types`, `_widgets/_utils`, `_widgets/_hooks`

The underscore prefix keeps these folders out of App Router route resolution, so colocation costs nothing in URL structure

## Promotion path

A unit starts in `_widgets/`. It moves up only when a second consumer appears:

1. `_widgets/_components` — one route owns it
2. `apps/<app>/src/components` — several routes in one app own it, re-exported from the app barrel
3. `packages/ui/src/components` — several apps own it, re-exported from the package barrel

See `rules/code-organization-rules.md`

## Related files

- `<monorepo>/apps/app/src/app/**/_widgets`
