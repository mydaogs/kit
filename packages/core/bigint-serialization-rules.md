# BigInt serialization rules

## Wire format

The canonical JSON representation of a `bigint` is the tagged wrapper
`{ "__bigint__": "<decimal-string>" }`, produced by `bigIntReplacer` and decoded
by `bigIntReviver`

The matched producer/consumer pair is `bigIntStringify` / `bigIntParse`. Use them
for any payload that may contain a `bigint` — chain event args, API responses,
persisted client state, and query keys mixing bigints with primitives

## Rules

- **Always serialize through the replacer.** Native `JSON.stringify` throws
  `Do not know how to serialize a BigInt` the moment it meets one
- **Always deserialize through the reviver.** Plain `JSON.parse` returns
  `{ __bigint__: "..." }` objects, and the next `BigInt(value)` throws
  `Cannot convert [object Object] to a BigInt` — one step removed from the real
  cause, which is why this is worth being strict about
- **Never install a global `BigInt.prototype.toJSON`.** `JSON.stringify` calls
  `toJSON` *before* the replacer, so an override silently flattens every bigint
  to a plain string. The round-trip still appears to work; readers that check
  `typeof === "bigint"` then reject every record
- **Treat wire numerics as `bigint | string | number` and coerce** with
  `toBigInt`. Do not use `typeof x === "bigint"` as a validator: a row may
  legitimately carry a decimal string, and a strict check silently drops it
- **Any consumer outside the fetch wrapper** — scripts, workers, indexers — must
  run bodies through `bigIntParse` if the endpoint can emit bigints. Check the
  response shape before assuming `res.json()` is safe

## When it does not apply

- An endpoint that deliberately projects a `bigint` to a stable scalar (for
  example `String(value)`) needs no reviver. Fine for a narrow contract, but the
  wrapper preserves type information end-to-end and is the better default
- Values already typed `number` need neither replacer nor reviver

## Examples

Wrong — raw stringify on a structure that may carry bigints:

```ts
JSON.stringify({ amount: 1000n });
// TypeError: Do not know how to serialize a BigInt
```

Wrong — plain parse on a wrapper payload:

```ts
const json = JSON.parse(text) as { amount: bigint };
BigInt(json.amount);
// SyntaxError: Cannot convert [object Object] to a BigInt
// json.amount is { __bigint__: "1000" }, not a string.
```

Wrong — strict validator over parsed event args:

```ts
if (typeof args.amount !== "bigint") return null; // drops every string row
```

Right — produce and consume through the pair:

```ts
import { bigIntParse, bigIntStringify } from "@mydaogs/core";

await store.write({ eventArgs: bigIntStringify(decoded.args) });
const args = bigIntParse<DecodedArgs>(row.eventArgs);
```

Right — coerce defensively at the boundary:

```ts
import { toBigInt } from "@mydaogs/core";

const amount = toBigInt(args.amount);
if (amount === null) return null;
```

## Persisted client state

A change to the on-disk shape of bigint-bearing state needs the persister's
`buster` bumped. Otherwise a returning client restores a shape the current
runtime cannot read. See
[`@mydaogs/query`](https://www.npmjs.com/package/@mydaogs/query)
