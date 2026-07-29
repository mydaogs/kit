# Docs rules

- Do not add dots in the end of chapter / paragraph to save context space
- Document only current behavior — never old-vs-current comparisons, migration narration, or build chronologies. See `dev-phase-state-rules.md`
- The folder's `README.md` is the record of upstream ownership. Give it a dedicated section listing every local doc that has a kit counterpart against the upstream file to read. Do not rely on a per-file header for this: it states one fact once per file, goes stale one file at a time, and is only reached after someone already opened the local copy — while the README is where they were told to start
- A doc may still open with a short note scoping what the local copy adds, and should when the boundary is not obvious — which symbols it binds, what it deliberately does not adopt. That is local content, not the ownership record, and does not exempt the folder README
- Name the upstream file explicitly (`@mydaogs/<package>` or `@mydaogs/shared-docs` plus its path). "See the kit" is not a pointer — the reader cannot act on it without searching
