# Docs rules

- Do not add dots in the end of chapter / paragraph to save context space
- Document only current behavior — never old-vs-current comparisons, migration narration, or build chronologies. See `dev-phase-state-rules.md`
- Record upstream ownership in the folder's `README.md`, in a dedicated section — never as a banner on each doc. List every local doc that has a kit counterpart against the upstream file to read. One banner per file repeats the same fact N times, goes stale one file at a time, and is read only after someone already opened the local copy; the folder README is where they were told to start
- Name the upstream file explicitly (`@mydaogs/<package>` or `@mydaogs/shared-docs` plus its path). "See the kit" is not a pointer — the reader cannot act on it without searching
