# Semantic CSS Token Contract for Cross-App Theming

## Problem

Consuming raw palette tokens (`--secondary`, `--border`) directly for decorative surfaces creates an implicit contract: every app must assign the same *visual role* to `--secondary` (sheet grid background, active highlight). An app that needs a different color for one of those surfaces cannot reassign `--secondary` without breaking every other surface relying on it, and ends up compensating with a local override stylesheet

## Solution

Introduce named semantic tokens in `packages/ui/styles.css` that describe *intent* rather than palette position. Components consume semantic tokens; apps map palette values onto semantic tokens in their own `variables.css`

## Semantic tokens

Defined in `packages/ui/styles.css` inside `@layer base :root` with safe defaults that fall back to raw palette tokens. Placing them in `@layer base` is critical: unlayered `:root` rules in each app's `variables.css` beat layered rules regardless of import order, so apps can simply define these tokens in their own `:root` without needing `!important` or import-order tricks

| Token | Default | Consumed by |
|---|---|---|
| `--sheet-grid-color` | `var(--secondary)` | the color an app plugs into its own `--sheet-grid-image` recipe |
| `--sheet-grid-image` / `--sheet-grid-size` | `none` / `0` | sheet, drawer, and dialog content background-image — off until an app sets both |
| `--danger-shell-grid-image` | a recipe over `--background` | the dangerous dialog shell's background-image, kept separate from `--sheet-grid-image` so recoloring one never recolors the other |
| `--capture-btn-active` | `var(--secondary)` | active capture-button frame + fill |
| `--capture-btn-inactive` | `var(--border)` | inactive capture-button frame |

Register Tailwind theme aliases in `@theme inline` for tokens that need utility classes, so shared components can use `bg-capture-btn-active/30`

## Rule

A shared component must never consume a raw palette token for a decorative surface. If it needs one, add a semantic token with a fallback default instead — that keeps the shared package themeable without any consuming app carrying overrides

The kit's own stylesheet only ever ships the token and a neutral or best-guess default — never the app's finished visual identity. `body` styling, page-level backgrounds, and scrollbar theming are not defined by the kit at all; an app that wants one of those effects builds it from its own palette using this same token pattern, in its own `variables.css`. This is the same extraction principle behind every other package in this kit: the shared package ships the mechanism, the consuming app supplies the opinion

## Related files

- `<monorepo>/packages/ui/styles.css`
- `<monorepo>/apps/*/src/styles/variables.css`
