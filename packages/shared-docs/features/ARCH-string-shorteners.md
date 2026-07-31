# [ARCH] - String Shorteners

## Description

Two differently-named helpers cover two different truncation needs. `truncateString` (`@mydaogs/core`) shortens opaque identifiers — transaction hashes, wallet addresses, database IDs — to a fixed leading/trailing character count. `truncateText` (`@mydaogs/ui`) truncates arbitrary display text to a caller-supplied or measured `maxLen`, cutting from the middle or the end

`TruncatedString` (`@mydaogs/ui/client`) wraps `truncateText` with tooltip and copy support. It can render inline, underlines truncated trigger text by default, and lets callers disable that affordance when the surrounding UI should stay visually quiet

## Related files

- `truncateString` (`@mydaogs/core`)
- `truncateText`, `TruncatedString` (`@mydaogs/ui` / `@mydaogs/ui/client`)
