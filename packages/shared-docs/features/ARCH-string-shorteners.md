# [ARCH] - String Shorteners

## Description

Shared helpers truncate long IDs for UI readability. `truncateString` shortens plain strings, and `TruncatedString` adds tooltip and copy support. `TruncatedString` can render inline, underlines truncated trigger text by default, and lets callers disable that affordance when the surrounding UI should stay visually quiet

The primary consumers are transaction hashes, wallet addresses, and database IDs surfaced in UI

## Related files

- `<monorepo>/packages/ui/src/lib/utils/truncateString.ts`
- `<monorepo>/packages/ui/src/components/TruncatedString/TruncatedString.tsx`
