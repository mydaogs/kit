# i18n String Rules

- All user-facing strings in `apps/app` must use `next-intl` message keys
- Do not ship hardcoded user text in JSX, toasts, dialog titles/descriptions, placeholders, labels, button text, or status messages
- For dynamic messages, use interpolation keys (for example `t("reason", { reason })`) instead of string concatenation
- When adding or renaming message keys, update every locale file in `<monorepo>/apps/app/messages/`
- Use existing namespaces first (`COMMON`, `ERRORS`, `FORMS`, feature-specific sections) and create a new namespace only if reuse is not clear
- Prefer the most specific namespace in `useTranslations` (for example `useTranslations("COMMON.BUTTONS")`), then use flat keys (for example `t("try-again")`)
- Do not mix broad namespace plus deep keys in the same file (for example `useTranslations("COMMON")` with `t("BUTTONS.try-again")`) unless there is a clear reason
- If a component is migrated from hardcoded text to i18n, remove or migrate any obsolete local literals in the same change
- When adding a new user-visible route that participates in a route-title registry or an intercepted dialog, add its title key to `ROUTES_TITLES` in every locale file and verify the path matcher still resolves any nested dynamic descendants

## When to use

- Any change that introduces or modifies user-visible text

## When not to use

- Non-user-facing developer-only strings (for example internal variable names or debug-only comments not rendered to users)
