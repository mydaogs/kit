# [ARCH] - Zod Schema Validation

## Description

Zod schemas validate all forms and request payloads, providing typed parsing and custom refinements where needed

## Behavior

- Schemas live under `<monorepo>/apps/app/src/lib/schemas`
- Used with react-hook-form `zodResolver`
- Cover shared primitives (email, address, wallet-request bodies) and per-feature form shapes
- Schemas needing localized messages are **factory-based** so validation text can be injected from the calling form rather than hardcoded in the schema module
- Numeric inputs that users type accept both dot and comma decimal separators and are parsed into an integer representation (for example basis points) before output
- A conditional branch is preprocessed off when its explicit toggle is disabled, so a hidden sub-form cannot block submission
- Numeric fields normalize valid values on blur to a fixed precision using the same separator convention, while invalid input stays visible so localized schema feedback can render

## Related files

- `<monorepo>/apps/app/src/lib/schemas/`
