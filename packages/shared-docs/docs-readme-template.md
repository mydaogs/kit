# Template: the docs tree entry point

Copy this file to the new repo's `docs/README.md`, then delete everything above
the horizontal rule. The four folders this kit ships each index themselves; this
is the one file that indexes *them*, and nothing upstream can write it for you
because half of what it points at is the project's own

Replace the placeholders from the [adoption table](README.md#placeholder-convention),
drop the rows for folders the project does not have, and add rows for the ones it
adds. `check-docs-adoption.mjs` fails if a folder exists and this file does not
link its `README.md`

---

# Docs

## Table of contents

- [`product/README.md`](product/README.md) - domain entities, user types, product vision
- [`decisions/README.md`](decisions/README.md) - architecture decisions and system structure
- [`rules/README.md`](rules/README.md) - hard rules for working in the repo
- [`units/README.md`](units/README.md) - reusable code unit tracking (components, hooks, utils, types)
- [`features/README.md`](features/README.md) - architecture blueprints and user stories
- [`runbooks/README.md`](runbooks/README.md) - operational procedures (deployment, database, integrations)

## Recommended reading order

1. [`product/README.md`](product/README.md)
2. [`decisions/tech-stack.md`](decisions/tech-stack.md)
3. [`decisions/monorepo.md`](decisions/monorepo.md)
4. [`decisions/backend.md`](decisions/backend.md)
5. [`decisions/frontend.md`](decisions/frontend.md)
6. [`decisions/data-flow.md`](decisions/data-flow.md)
7. [`rules/README.md`](rules/README.md)
8. [`units/README.md`](units/README.md)

## Reusable code pieces

Some docs live next to their implementation rather than in this tree, so they
move when the code moves. The barrels a new unit is exported from:

- `<monorepo>/packages/ui/src/lib/['utils' | 'hooks' | 'types']/index.ts` - reusable *across apps* utilities, hooks, types
- `<monorepo>/packages/ui/src/components/**/index.ts` - reusable UI components (re-exported per component folder)
- `<monorepo>/apps/*/src/lib/['utils' | 'hooks' | 'types']/index.ts` - reusable *within an app* utilities, hooks, types
- `<monorepo>/apps/*/src/components/**/index.ts` - reusable app components (re-exported per component folder)
- `<monorepo>/apps/app/src/actions/index.ts` - client-safe server actions

## Rules for creating new code pieces

See [`rules/code-organization-rules.md`](rules/code-organization-rules.md)

## Docs that live in packages

Parts of this tree are adopted from [`@mydaogs/shared-docs`](https://www.npmjs.com/package/@mydaogs/shared-docs)
and the `@mydaogs/*` packages. The two are **not** copies of each other and
neither replaces the other:

- A **kit doc** describes the package's behaviour — its exported API, its
  invariants, what breaks if you change them. It ships with the package and
  renders on its npm page
- The **doc of the same name here** describes this product's adoption of that
  pattern: which apps use it, which routes, which entities, and the decisions
  that only make sense with this project's constraints in view

So a shared name means the two are related, not redundant. The kit doc is
authoritative for package behaviour; this tree is authoritative for how the
product uses it and for everything product-specific

Each folder's `README.md` records which of its docs have an upstream counterpart
and which file each one tracks. Check the version actually resolved in the
lockfile before treating an upstream doc as current
