# Docs rules

## Rules description

These rules define where docs live, how a reader reaches them, and how a copied doc keeps its link to the file it came from

## When to use

- Every time a doc is created, moved, or deleted
- Every time a folder gains or loses a doc, since the folder index is part of the change
- When adopting this kit into a new repo

## Tree structure

- `docs/` at the **repository root** is the only documentation folder. Never create a `docs/` directory inside a workspace, app, or package. A second tree splits the answer to "where is this documented" into two places, and the one nobody checks goes stale unobserved
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

These are checks, not conventions. Wire both into CI:

- `node node_modules/@mydaogs/shared-docs/check-docs-adoption.mjs docs` — entry point links every folder, every folder indexes itself, every doc is indexed, carried folders carry an ownership record, the four project-authored decisions exist, and no path placeholder survived
- `node node_modules/@mydaogs/shared-docs/check-links.mjs` is the kit's own link check; point an equivalent at `docs/` so every relative markdown link resolves

A broken index or a dangling link is silent otherwise — the doc still renders, it just sends the reader nowhere
