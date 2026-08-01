# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A pnpm workspace that publishes 12 packages to public npm under the `@mydaogs` scope: 11 TypeScript packages plus [`@mydaogs/shared-docs`](packages/shared-docs/README.md), which ships markdown only. Everything is domain-free — no product entities, deployment identifiers, hardcoded chains, or routes. Most packages export **factories**, not singletons: the consuming app supplies its own vocabulary, copy, transport, and storage

There is no app here to run. The deliverables are the tarballs and the docs

## Commands

```bash
pnpm install
pnpm check          # what CI runs: check-types + lint + verify + check-links + check:doc-ownership
pnpm build          # tsup → dist/ for the 11 code packages
pnpm verify:dist    # packs, installs, and imports every tarball under plain Node ESM
```

Narrower loops:

```bash
pnpm exec tsx scripts/smoke.ts          # one test file (there is no test-name filter)
pnpm exec tsx scripts/smoke-dom.ts
pnpm --filter @mydaogs/web3 check-types # one package
pnpm --filter @mydaogs/web3 lint
pnpm lint                               # eslint packages/*/src scripts --max-warnings 0
```

Two package-local guards are **not** wired into `pnpm check` and must be run by hand when touching those packages:

```bash
pnpm --filter @mydaogs/cache-handler check:no-bare-specifiers  # no @mydaogs/* imports
pnpm --filter @mydaogs/contract check:contract-hygiene         # no kv/cache-handler/indexer/prisma
```

`pnpm check:cache-handlers` and `pnpm check:bare-revalidate` are guards meant to be copied into a *consuming* repo and pointed at its app directories. They exit non-zero when they scan zero files, so running them against this workspace correctly fails — that is intended, not a bug to fix

## Architecture

Packages are grouped by **dependency boundary and runtime environment**, never by feature. Merging any two would force a wrong dependency on someone — a backend importing React, a browser bundle importing Redis

```
core ──┬── contract ──── web3-tx ──┐
       ├── indexer                 ├── web3-client   (React, "use client")
       └── web3 ───────────────────┘
query ──── query-client                              (React, "use client")
kv          (server only, imports server-only)
cache-handler  (zero deps — takes a structural KvClient from the host)
```

Four boundaries are load-bearing; [README.md](README.md#why-this-split) explains each. The two that are easiest to break by accident:

- **`"use client"` and the `react` peer dependency fall on exactly the same line.** Every module in `query-client` and `web3-client` imports React; nothing in `query` or `web3-tx` does. Adding a React import to `query`/`web3-tx` puts isomorphic code (`CACHE_TIMES`, `createQueryFns`, the whole tx registry) behind a client boundary
- **`cache-handler` may not import any workspace package.** Reader apps load the compiled handler outside Next's transpile pipeline, where a bare workspace specifier is unresolvable on a serverless host's flattened layout

`exports` points at TypeScript **source** so workspace consumers need no build step; `publishConfig` substitutes compiled `dist/` at publish time. That substitution only materializes inside a tarball, which is why `verify:dist` exists separately from `build`

### Before changing behavior

[README.md § Invariants worth preserving](README.md#invariants-worth-preserving) lists the properties that break correctness *silently* rather than failing loudly — tx-registry ordering and fencing, fail-closed identity-scoped cache reset, origin pinning in both fetch lanes, `stableHash` over `JSON.stringify`, status gaps never dead-lettering. Read the relevant entry before editing those areas; each one is there because it was gotten wrong once

## Testing

No test framework. Tests are plain `node:assert/strict` scripts run under `tsx`:

- [`scripts/smoke.ts`](scripts/smoke.ts) — behavioral assertions over the pure logic, then a **regression block** (from the `── Regression assertions ──` marker down) where every bug found in review is pinned. Fixing a bug means adding an assertion there
- [`scripts/smoke-dom.ts`](scripts/smoke-dom.ts) — storage-layer coverage against a fake `localStorage`. Kept separate so `smoke.ts` stays dependency-free; it installs globals *before* dynamically importing the modules under test

Note that [`packages/shared-docs/rules/testing-rules.md`](packages/shared-docs/rules/testing-rules.md) forbids offchain tests — that rule governs the *consuming* monorepo, not this repo

## Docs are enforced, not conventional

[`scripts/check-doc-ownership.mjs`](scripts/check-doc-ownership.mjs) fails `pnpm check` when:

- A package doc (root or nested, at any depth) mentions `<monorepo>`, `apps/<name>`, the product name, or `@shared/`. Those mean the doc is describing somebody's app, not this package. Move it to `shared-docs`, which is exempt from *this* half — describing app architecture is its whole job
- A shipped `.md` is not linked from its package README as `](./name.md)`, or the README links one that does not exist
- A `shared-docs` folder index (`rules`, `decisions`, `features`, `units`) disagrees with its folder. Every `.md` in the folder must be indexed, and every indexed name that is *not* in the folder must say where it is on the same line — `` `name.md` → `@mydaogs/<package>` `` or `` `name.md` → project-authored ``. Half the kit's blueprints ship with their package, so the index is one list across both halves rather than a directory listing

`pnpm check-links` resolves every relative markdown link under `packages/shared-docs`. [`docs-readme-template.md`](packages/shared-docs/docs-readme-template.md) is skipped there on purpose — its links resolve in the consumer's `docs/`, not here

[`packages/shared-docs/check-docs-adoption.mjs`](packages/shared-docs/check-docs-adoption.mjs) is the consumer-side counterpart and is **not** wired into `pnpm check` — there is no docs tree here to scan. It ships in the tarball as a `bin` rather than being copied, and is run against an adopted repo:

```bash
node packages/shared-docs/check-docs-adoption.mjs ../<some-repo>
```

It takes the repo root or the `docs/` dir. In a consuming repo `docs/` sits at the repository root, above the workspaces — often above any npm project at all — so the checks are invoked from a repo-root `package.json` that exists only for tooling, not from a workspace. `check-links.mjs` takes a directory for the same reason, defaulting to this package

[`init-docs.mjs`](packages/shared-docs/init-docs.mjs) is the other half: it scaffolds the tree into an empty repo and generates each carried folder's ownership record from the files it copied. Changing what `shared-docs` ships changes what it scaffolds, so re-run it into a scratch repo after adding or removing a folder

A doc in `rules/`, `decisions/`, `features/`, or `units/` must not link outside its own folder by relative path. Those four are copied wholesale into a consuming `docs/`, where there is no `../` to resolve against — the link works here and is dead in every adopted tree. `check:doc-ownership` fails on it

When editing any of the four `shared-docs` folders, the index entry is part of the change — adding, renaming, moving, or deleting a doc without touching the folder `README.md` fails `pnpm check`

When writing docs here, follow the repo's own rules:

- No trailing period at the end of a bullet or paragraph
- Document current behavior only — no "previously", "no longer", "this replaces", migration narration, or build chronologies. Rationale is stated as a present-tense constraint. Full rule: [`rules/dev-phase-state-rules.md`](packages/shared-docs/rules/dev-phase-state-rules.md)
- Fetch library/API facts from a documentation MCP server rather than recalling them ([`rules/external-docs-rules.md`](packages/shared-docs/rules/external-docs-rules.md))

`packages/shared-docs/**` is *content shipped to consumers*, written against placeholders (`<monorepo>`, `apps/app`, `APP_TAGS`, `Entity`). Its rules describe a downstream Next.js + Prisma monorepo and are not instructions for working in this repository

## Releasing

`package.json` is the version of record; the git tag only triggers the release. All 13 manifests (root + 12 packages) carry the same version, and [`release.yml`](.github/workflows/release.yml) fails before any upload if `v<x.y.z>` does not equal every `packages/*/package.json` version. Publishing uses `pnpm -r publish` because only pnpm rewrites `workspace:*` to a real range; provenance is configured through `NPM_CONFIG_PROVENANCE`, since pnpm silently swallows `--provenance`

## Code conventions

- ESM only, `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`, `target: ES2022`
- `@typescript-eslint/no-explicit-any` is an **error** — wire boundaries take `unknown` and narrow
- Named exports only, re-exported from each package's `src/index.ts` barrel with types exported alongside their values
- Commits are conventional with a package scope: `fix(indexer): …`, `feat(web3-client)!: …` for breaking changes
