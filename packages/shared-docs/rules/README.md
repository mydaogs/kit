# General Rules Guideline

## Rules for adding a new General Rule

- All _General Rules_ must be listed in this current file list below for easy navigation. Keep this list updated
- _General Rules_ file must be structured following a template below
- An entry marked `→ @mydaogs/<package>` ships with that package rather than in this folder; read it at the package root

## Template for documenting General Rules

- File name `[<rule-name>]-rules.md`
- Rules bullet list
- When to use and when NOT to use (if applicable)
- Examples (if applicable)

## General Rules list (file name + one sentence short description)

1. `docs-rules.md` - Rules for writing docs
2. `testing-rules.md` - Rules for where tests are required and where they are not
3. `external-docs-rules.md` - Rules for external libraries and packages
4. `code-organization-rules.md` - Rules for where new code should live and how to export it
5. `dev-workflow-rules.md` - Rules for running dev, build, lint, format, and DB tasks
6. `loading-state-rules.md` - Rules requiring shared loading primitives instead of ad-hoc loaders
7. `i18n-string-rules.md` - Rules requiring `next-intl` keys for all user-facing UI text
8. `auth-permission-rules.md` - Rules for checking permissions in server actions and API route handlers
9. `forms-rules.md` - Rules for implementing consistent forms with `react-hook-form`, Zod schemas, shared form UI, and server actions
10. `pagination-rules.md` - Rules for cursor pagination, lazy infinite scrolling, and approved exceptions
11. `admin-actions-rules.md` - Rules requiring wallet-signature submission and onchain role verification for all admin actions
12. `prisma-mongodb-rules.md` - Rules for avoiding null-vs-missing filter pitfalls and intra-handler retry loops when using Prisma with MongoDB
13. `bigint-serialization-rules.md` → `@mydaogs/core` - Rules for serializing and consuming `bigint` values across JSON boundaries
14. `tabs-query-param-rules.md` - Rules for URL-synced tab state
15. `contract-lifecycle-rules.md` - Rules coupling contract deploys/upgrades with database prunes, webhook regeneration, and the indexer cold-start floor
16. `dev-phase-state-rules.md` - Rules forbidding old-vs-current documentation and requiring a version bump instead of a migration while data is disposable
