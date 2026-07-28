# Semantic CSS Token Contract for Cross-App Theming

## Problem

Consuming raw palette tokens (`--secondary`, `--border`) directly for decorative surfaces creates an implicit contract: every app must assign the same *visual role* to `--secondary` (page grid accent, scrollbar track, sheet grid background, active highlight). An app that needs a different color for one of those surfaces cannot reassign `--secondary` without breaking every other surface relying on it, and ends up compensating with a local override stylesheet

## Solution

Introduce named semantic tokens in `packages/ui/src/styles/globals.css` that describe *intent* rather than palette position. Components consume semantic tokens; apps map palette values onto semantic tokens in their own `variables.css`

## Semantic tokens

Defined in `packages/ui/src/styles/globals.css` inside `@layer base :root` with safe defaults that fall back to raw palette tokens. Placing them in `@layer base` is critical: unlayered `:root` rules in each app's `variables.css` beat layered rules regardless of import order, so apps can simply define these tokens in their own `:root` without needing `!important` or import-order tricks

| Token | Default | Consumed by |
|---|---|---|
| `--page-grid-color` | `var(--secondary)` | `body` background-image |
| `--scrollbar-track-color` | `var(--secondary)` | scrollbar track variable |
| `--sheet-grid-color` | `var(--secondary)` | sheet content background-image |
| `--control-active-color` | `var(--secondary)` | active control frame + fill |
| `--control-inactive-color` | `var(--border)` | inactive control frame |

Register Tailwind theme aliases in `@theme inline` for tokens that need utility classes, so shared components can use `bg-control-active/30`

## Rule

A shared component must never consume a raw palette token for a decorative surface. If it needs one, add a semantic token with a fallback default instead — that keeps the shared package themeable without any consuming app carrying overrides

## Related files

- `<monorepo>/packages/ui/src/styles/globals.css`
- `<monorepo>/apps/*/src/styles/variables.css`
