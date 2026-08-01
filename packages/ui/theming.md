# Theming

`@mydaogs/ui/styles.css` defines a token *contract*, not token *values*. Components consume semantic CSS custom properties and neutral geometry defaults; the consuming app supplies the palette — and, where it wants one, the app's own visual identity on top — by defining those properties, unlayered, on `:root` in its own stylesheet.

## What the stylesheet ships

- A `@theme inline` block mapping Tailwind utility names (`bg-main`, `text-foreground`, `shadow-shadow`, `rounded-base`, …) onto semantic custom properties (`--main`, `--foreground`, `--shadow`, `--border-radius`, …), including `--border-width-base` (aliasing `--border-width`)
- Every border/outline width in the components (`border-(length:--border-width-base)`, `border-t-(length:--border-width-base)`, `outline-(length:--border-width-base)`, …) is Tailwind's arbitrary-value CSS-variable syntax, not a `border-base`-style named utility. `--radius-*` and `--shadow-*` are real Tailwind theme namespaces that auto-generate named utilities (`rounded-base`, `shadow-shadow`); border-width has no such namespace, and a hand-rolled `border-base` utility collides with Tailwind's `border-<color>` naming — `tailwind-merge` (used by every component's `cn()`) classifies it as a border-*color* utility and silently drops it next to `border-border`. The arbitrary-value form sidesteps that collision entirely
- A small set of geometry defaults in `@layer base :root`, all neutral until an app opts into something more opinionated:
  - `--border-radius: 8px`
  - `--border-width: 1px`
  - `--box-shadow-x` / `--box-shadow-y`: `0px`
  - `--reverse-box-shadow-x` / `--reverse-box-shadow-y`: `0px`
  - `--shadow`, derived from the box-shadow vars above — never hardcode this, override the vars it's built from instead
  - `--heading-font-weight: 700`, `--base-font-weight: 500`
- A `@layer base` block defining secondary surface tokens (`--sheet-grid-color`, `--sheet-grid-image`, `--sheet-grid-size`, `--danger-shell-grid-image`, `--danger-shell-grid-size`, `--capture-btn-active/inactive`) that fall back to `--secondary` / `--border` / `none`
- `@source "./dist"` — the stylesheet registers its own compiled output as a Tailwind v4 source path, relative to itself, so class names used inside `@mydaogs/ui`'s components are always scanned regardless of where the package lands in `node_modules`

## What the consumer must define

Define these as custom properties on an **unlayered** `:root` block in the app's own stylesheet — unlayered rules beat `@layer base` regardless of import order, which is what lets the app override without `!important` or import-order tricks:

- Core palette: `--main`, `--background`, `--primary`, `--secondary`, `--foreground`, `--main-foreground`, `--accent-foreground`, `--border`, `--overlay`, `--ring`
- Status palette: `--success`, `--error`, `--info`, `--warn`, `--danger`, `--system`
- Capture button accents: `--capture-btn-active`, `--capture-btn-inactive` (optional — fall back to `--secondary` / `--border`)
- Font family variables referenced by `--font-sans` / `--font-mono` (e.g. via `next/font`)

Geometry (`--border-radius`, `--border-width`, `--box-shadow-x/y`, `--reverse-box-shadow-x/y`, `--heading-font-weight`, `--base-font-weight`) ships with neutral defaults above and only needs overriding if the app wants a different look — for example, restoring a visible drop-shadow-style press effect:

```css
:root {
  --box-shadow-x: 4px;
  --box-shadow-y: 4px;
  --reverse-box-shadow-x: -4px;
  --reverse-box-shadow-y: -4px;
}
```

`Button`'s `active:translate-x-boxShadowX active:translate-y-boxShadowY` press effect is wired up regardless — it is a no-op with the `0px` defaults above until an app sets these.

### Opting into a sheet/dialog/drawer grid background

`sheet.tsx`, `drawer.tsx`, and `dialog.tsx` share one recipe, driven by two tokens that default to `none` / `0` (so the background is plain until an app opts in) plus the `--sheet-grid-color` token every one of them already falls back to:

```css
/* app/globals.css, unlayered :root — reproduces the dotted-grid look */
:root {
  --sheet-grid-image:
    linear-gradient(to right, var(--sheet-grid-color) 1px, transparent 1px),
    linear-gradient(to bottom, var(--sheet-grid-color), transparent 1px);
  --sheet-grid-size: 70px 70px;
}
```

Note the asymmetry: `1px` on the horizontal (`to right`) gradient's color stop, none on the vertical (`to bottom`) one. That's not a typo — it's the exact recipe the grid has always rendered with, and copying it with `1px` on both turns the vertical gridlines from a soft fade into a crisp line.

The dangerous dialog shell (`DialogShellHost`) uses separate `--danger-shell-grid-image` / `--danger-shell-grid-size` tokens instead of sharing `--sheet-grid-image` / `--sheet-grid-size` — folding them together would recolor (and rescale) the dangerous shell every time an app customized its sheet grid. `--danger-shell-grid-image` defaults to the same recipe over `--background`, and `--danger-shell-grid-size` defaults to `70px 70px`, so overriding either is optional.

## What this stylesheet no longer touches

These used to be defined here and now are not — a consuming app that wants any of them defines them itself, unlayered, in its own stylesheet:

- `body` — background, font, and min-height rules
- `main` — max-width and centering
- `h1`–`h6` — heading font assignment beyond what `font-heading` already gives a component that opts in
- Scrollbar styling (`.scrollbar`, `.toc-scrollbar`, `.command-scrollbar`, and the WebKit/`scrollbar-color` rules that backed them)

## Wiring it up

The package does not declare `@import "tailwindcss"` itself — the app owns the Tailwind entry point:

```css
/* app/globals.css */
@import "tailwindcss";
@import "@mydaogs/ui/styles.css";
```

Import the app's own `:root` token file before this stylesheet so the cascade order is predictable, though layering makes the exact order forgiving for anything defined in `@layer base`.
