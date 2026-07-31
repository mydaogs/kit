# Theming

`@mydaogs/ui/styles.css` defines a token *contract*, not token *values*. Components consume semantic CSS custom properties; the consuming app supplies the palette by defining those properties, unlayered, on `:root` in its own stylesheet.

## What the stylesheet ships

- A `@theme inline` block mapping Tailwind utility names (`bg-main`, `text-foreground`, `shadow-shadow`, `rounded-base`, …) onto semantic custom properties (`--main`, `--foreground`, `--shadow`, `--border-radius`, …)
- A small set of geometry defaults (`--border-radius`, `--box-shadow-x/y`, font weights) with concrete fallback values
- A `@layer base` block defining secondary surface tokens (`--page-grid-color`, `--scrollbar-track-color`, `--sheet-grid-color`, `--capture-btn-active/inactive`) that fall back to `--secondary` / `--border`
- `@source "./dist"` — the stylesheet registers its own compiled output as a Tailwind v4 source path, relative to itself, so class names used inside `@mydaogs/ui`'s components are always scanned regardless of where the package lands in `node_modules`

## What the consumer must define

Define these as custom properties on an **unlayered** `:root` block in the app's own stylesheet — unlayered rules beat `@layer base` regardless of import order, which is what lets the app override without `!important` or import-order tricks:

- Core palette: `--main`, `--background`, `--primary`, `--secondary`, `--foreground`, `--main-foreground`, `--accent-foreground`, `--border`, `--overlay`, `--ring`
- Status palette: `--success`, `--error`, `--info`, `--warn`, `--danger`, `--system`
- Capture button accents: `--capture-btn-active`, `--capture-btn-inactive` (optional — fall back to `--secondary` / `--border`)
- Font family variables referenced by `--font-sans` / `--font-mono` (e.g. via `next/font`)
- Layout heights consumed by some composites: `--height-nav`, `--height-footer`, `--height-content`

## Wiring it up

The package does not declare `@import "tailwindcss"` itself — the app owns the Tailwind entry point:

```css
/* app/globals.css */
@import "tailwindcss";
@import "@mydaogs/ui/styles.css";
```

Import the app's own `:root` token file before this stylesheet so the cascade order is predictable, though layering makes the exact order forgiving for anything defined in `@layer base`.
