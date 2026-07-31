# Docs rules

## Rules description

These rules define where docs live, how a reader reaches them, and how a copied doc keeps its link to the file it came from

## When to use

- Every time a doc is created, moved, or deleted
- Every time a folder gains or loses a doc, since the folder index is part of the change
- When adopting this kit into a new repo

## Tree structure

- `docs/` at the **repository root** is the only documentation folder, and sits beside the workspaces rather than inside one. A repo may hold several workspaces or none that are npm at all, so the root is the only level every project shares. Never create a `docs/` directory inside a workspace, app, or package: a second tree splits the answer to "where is this documented" into two places, and the one nobody checks goes stale unobserved. Both halves of this are enforced — see [Enforcement](#enforcement)
- A reusable package documents itself in root-level markdown next to its `package.json` (`README.md` and siblings). That is not a `docs/` directory, and it is what npm renders
- `docs/README.md` is the entry point and the only file that indexes the folders. It carries a table of contents linking every folder's `README.md`, and a recommended reading order. Adopt it from [`docs-readme-template.md`](../docs-readme-template.md)
- Four folders are carried from this kit and keep their names: `rules/`, `decisions/`, `features/`, `units/`
- Every project adds `product/` and `runbooks/` — the kit ships no copy of either, because product vision and operational procedure are project-specific by nature
- Anything further (`diagrams/`, `legal-drafts/`) is the project's own, and follows the same folder rules

## Folder indexes

- Every folder has a `README.md` that indexes its own contents: file name plus a one-sentence description, kept in a list
- Every doc in a folder appears in that folder's index. An unindexed doc is unreachable — nothing links it, and the reader was told to start at the index
- An index entry whose file is not in the folder **must name where the file is**: `` `name.md` → `@mydaogs/<package>` `` when a kit package owns it, `` `name.md` → project-authored `` when there is no upstream copy. A bare name with no file and no pointer sends the reader looking for something that was never there
- Deleting a doc means deleting its index entry in the same change, and renumbering the list around it
- Per-folder file naming and templates are defined in each folder's `README.md` — rules are `<rule-name>-rules.md`, features are `ARCH-<name>.md` or `STORY-<name>.md`, everything else is kebab-case

## One home per doc

- A doc that describes a **package's** behaviour — its exported API and the invariants behind it — belongs with that package, not in the docs tree. The moment it names a consuming app's directories it has stopped describing the package
- A doc that describes **how this product uses** a pattern belongs in the docs tree, and may name real routes, entities, and paths freely
- The two may share a name. That means they are related, not redundant: the package doc is authoritative for behaviour, the local doc for adoption
- `ARCH-*` blueprints are portable between projects. `STORY-*` docs are user stories and never are

## Upstream ownership record

- The folder's `README.md` is the record of upstream ownership. Give it a dedicated section listing every local doc that has a kit counterpart against the upstream file to read. Do not rely on a per-file header for this: it states one fact once per file, goes stale one file at a time, and is only reached after someone already opened the local copy — while the README is where they were told to start
- A doc may still open with a short note scoping what the local copy adds, and should when the boundary is not obvious — which symbols it binds, what it deliberately does not adopt. That is local content, not the ownership record, and does not exempt the folder README
- Name the upstream file explicitly (`@mydaogs/<package>` or `@mydaogs/shared-docs` plus its path). "See the kit" is not a pointer — the reader cannot act on it without searching
- Say which side to edit. A fix to package behaviour belongs upstream; a fix to how this project binds it belongs locally. Without that, both get edited locally and the upstream fix is lost at the next adoption
- Replace every path and slug placeholder repo-wide when adopting — `<monorepo>`, `<contracts>`, `<project>`, `<provider>`, `apps/app`. A survivor points at a directory that does not exist. Quoting the kit's own wording inside the ownership record is not a survivor and needs no replacing

## Writing

- Do not add dots in the end of chapter / paragraph to save context space
- Document only current behavior — never old-vs-current comparisons, migration narration, or build chronologies. See [`dev-phase-state-rules.md`](dev-phase-state-rules.md)

## Enforcement

These are checks, not conventions. A broken index, a dangling link, or a second docs tree is silent otherwise — the doc still renders, it just sends the reader nowhere

`docs/` sits at the repository root, above the workspaces. That level owns the docs and is the level the checks run from, so it carries a `package.json` whose only job is repo-level tooling — no app, no build, no source:

```json
{
  "name": "<project>-repo",
  "private": true,
  "scripts": {
    "check:docs": "check-docs-adoption docs",
    "check:docs-links": "check-docs-links docs"
  },
  "devDependencies": {
    "@mydaogs/shared-docs": "^0.6.6"
  }
}
```

A workspace's own `package.json` is the wrong home for this. It would make the docs gate depend on that workspace still existing and still being the one that happens to install the kit, when what is being checked sits outside every workspace

- `check:docs` — `docs/` is at the repository root and is the only docs tree, the entry point links every folder, every folder indexes itself, every doc is indexed, carried folders carry an ownership record, the four project-authored decisions exist, and no path placeholder survived
- `check:docs-links` — every relative markdown link under `docs/` resolves

Both fail when they scan nothing, because a guard that cannot tell "no violations" from "scanned nothing" reports success forever after a directory move

Trigger CI on `docs/**` rather than on a workspace path. A guard wired to the wrong path fires when unrelated code changes and stays silent on the one change that matters
