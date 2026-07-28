# Prisma + MongoDB Rules

## Rules

- Do not filter on `where: { nullableField: null }` expecting it to match documents where the field is missing from the BSON document. In Prisma with MongoDB, `null` filters match documents where the field is explicitly stored as `null`, not documents where the field is absent
- Treat "missing field" and "null field" as distinct states when writing filters. Prefer setting nullable fields explicitly on create so the two cases never diverge, or filter with `{ field: { isSet: false } }` when you need to match absent fields
- Do not rely on `updateMany` predicates over nullable fields as an optimistic-concurrency guard. If the field can be missing, the predicate will silently return `count = 0` every call, even for the row you intended to update
- For blockchain event handlers, rely on the upstream `claimEventAtomic` (per event hash) and `claimTxSync` (per tx hash) ledgers for concurrency instead of intra-handler retry loops. These already serialize indexer-initiated and user-initiated syncs

## When to use

- Any time a Prisma model on MongoDB has `String?`, `Int?`, or other nullable fields that are not always set on create
- Any time an event handler writes to fields that may or may not already exist on the target document

## When NOT to use

- Not applicable to Prisma with relational adapters (Postgres, MySQL, SQLite), where `null` filters and missing-column semantics do not diverge the same way

## The `not: null` inverse gotcha

The asymmetry has an inverse that bites negative filters. Because `{ field: null }` matches only stored `null` (not absent), Prisma's MongoDB connector treats `{ field: { not: null } }` as the set-complement of "stored null" — which **includes absent fields**. So `{ field: { not: null } }` matches both genuine non-null values _and_ documents where the field was never written

This means a "has a real value" filter cannot be written as `{ field: { not: null } }` alone when any create path omits the field. Combine it with `isSet: true`:

```ts
// "field holds a real, set, non-null value"
{ field: { not: null, isSet: true } }
```

This bites hardest where a Prisma count predicate and a JS-side derivation must agree. If receipts are created without a `readAt` (absent), then `receipts: { none: { userId, readAt: { not: null } } }` matches the absent-`readAt` receipt, `none` evaluates false, and a freshly created record counts as read — while a list that derives readness in JS via `receipt?.readAt ?? null` treats absent as unread. The badge shows `0` while the list renders unread. `readAt: { not: null, isSet: true }` is what keeps the two in agreement

## Named predicates

For fields where this applies, define a named shared predicate near the query builders rather than repeating the `OR`:

```ts
export const UNRESOLVED_OR = [
  { resolvedAt: null },
  { resolvedAt: { isSet: false } },
];
```

## Write rule

Prefer writing explicit `null` for optional fields when the field has domain meaning and the create path knows the value is absent. This keeps documents consistent, but it does not remove the need for `isSet: false` in read filters: any create path that omits the field — including Prisma's own default for an unset optional — still produces an absent field

## Examples

### Wrong

```ts
// Fresh rows are created without reviewerAddress set, so the field is missing
// from the BSON doc. This predicate never matches, count is always 0, and the
// "concurrent updates" fallback throws.
await prismaClient.organization.updateMany({
  where: {
    id: orgId,
    applicationStatus: "PENDING",
    reviewerAddress: null,
    rejectionReason: null,
  },
  data: {
    applicationStatus: "APPROVED",
    reviewerAddress: reviewedBy,
    rejectionReason: null,
  },
});
```

### Right

```ts
// Single-writer handler: read, short-circuit on idempotent replay,
// unconditional update by unique id. Upstream claim ledgers serialize
// concurrent callers, so no intra-handler retry loop is needed.
const org = await prismaClient.organization.findUnique({
  where: { id: orgId },
  select: {
    applicationStatus: true,
    reviewerAddress: true,
    rejectionReason: true,
  },
});

const alreadySynced =
  org?.applicationStatus === "APPROVED" &&
  org.reviewerAddress === reviewedBy &&
  !org.rejectionReason;

if (!alreadySynced) {
  await prismaClient.organization.update({
    where: { id: orgId },
    data: {
      applicationStatus: "APPROVED",
      reviewerAddress: reviewedBy,
      rejectionReason: null,
    },
  });
}
```

### Right (when you really need to distinguish absent vs. null)

```ts
await prismaClient.organization.findMany({
  where: {
    reviewerAddress: { isSet: false },
  },
});
```

## Schema changes

- A schema change that existing rows cannot satisfy is resolved by pruning and reseeding, never by a backfill script. See `dev-phase-state-rules.md`
