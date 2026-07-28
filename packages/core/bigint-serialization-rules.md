# BigInt Serialization Rules

## Wire format

- The canonical JSON representation of a `bigint` is the tagged wrapper `{ "__bigint__": "<decimal-string>" }`, produced by `bigIntReplacer` and decoded by `bigIntReviver` from `<monorepo>/apps/app/src/lib/utils/bigIntJson.ts`
- The matched producer/consumer pair is `bigIntStringify` and `bigIntParse`. Use them whenever a payload may contain a `bigint`, including event args, API responses, persisted query state, and query keys that mix bigints with primitives

## Rules

- Always serialize structures that may contain `bigint` through `bigIntReplacer` (`bigIntStringify`, `JSON.stringify(value, bigIntReplacer)`, or `createApiResponse`, which already wraps it). Never call raw `JSON.stringify` on such structures: native `JSON.stringify` throws `Do not know how to serialize a BigInt` on encountering one
- Always deserialize payloads produced by `bigIntStringify` through `bigIntReviver` (`bigIntParse`, `JSON.parse(value, bigIntReviver)`, or a fetcher that wraps it like `createQueryFn`). Plain `JSON.parse` returns wrappers as `{ __bigint__: "..." }` objects, and any downstream `BigInt(value)` call will throw `Cannot convert [object Object] to a BigInt`
- Do not reinstall a global `BigInt.prototype.toJSON`. `JSON.stringify` invokes `toJSON` before the replacer, so any such override silently flattens bigints to plain strings and breaks the round-trip — readers that check `typeof === "bigint"` will reject every record
- When parsing event args or other wire data, treat numeric fields as `bigint | string | number` and coerce with `BigInt(...)` (or a small `toBigInt` helper) before consuming. Do not rely on `typeof args.x === "bigint"` as a hard validator: a row may carry a plain decimal string, and that must not silently filter the record out
- New external consumers of internal HTTP routes (Node scripts, workers, the local indexer, anything outside `createQueryFn`) must run response bodies through `bigIntParse(await res.text())` if the route may emit `bigint` fields. Audit the route's response shape before assuming plain `await res.json()` is safe
- Bump the React Query persistence buster whenever a change alters the on-disk shape of bigint-bearing query state. Otherwise users with persistence consent restore a stale shape into a runtime that cannot accept it

## When to use

- Anywhere a payload originates from chain-decoded event args (`viem.decodeEventLog`) and is serialized for storage, persisted query state, an API response, or any other JSON channel
- Any consumer that reads from such a channel

## When NOT to use

- Routes that explicitly project a `bigint` to a stable scalar form (for example `String(value)` in the response body) do not need a reviver on the consumer side. This is fine for narrow contracts, but prefer the wrapper round-trip for new endpoints — it preserves type information end-to-end
- Plain numeric counters that are already `number` need neither replacer nor reviver. Only structures that may contain a `bigint` are in scope

## Examples

### Wrong — raw `JSON.stringify` on a structure that may carry bigints

```ts
const payload = { amountUSD: 1_000n };
console.log(JSON.stringify(payload));
// Throws: TypeError: Do not know how to serialize a BigInt
```

### Wrong — plain `JSON.parse` on a wrapper-format payload

```ts
const json = JSON.parse(text) as { amountUSD: bigint };
const value = BigInt(json.amountUSD);
// Throws: SyntaxError: Cannot convert [object Object] to a BigInt
// because json.amountUSD is { __bigint__: "1000" }, not a string.
```

### Wrong — strict bigint validator on parsed event args

```ts
if (typeof args._amountUSD !== "bigint" || typeof args._timestamp !== "bigint") {
  return null; // Silently rejects every plain-string row.
}
```

### Right — produce/consume through the helpers

```ts
import { bigIntParse, bigIntStringify } from "@/lib/utils/bigIntJson";

await prismaClient.processedBlockchainEvent.update({
  where: { eventHash },
  data: { eventArgs: bigIntStringify(decoded.args) },
});

const args = bigIntParse<DecodedArgs>(row.eventArgs);
```

### Right — coerce wire numerics defensively

```ts
const toBigInt = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
};

const amountUSD = toBigInt(args._amountUSD);
const timestamp = toBigInt(args._timestamp);
if (amountUSD === null || timestamp === null) return null;
```

### Right — external Node consumer of an internal route

```ts
import { bigIntParse } from "@/lib/utils/bigIntJson";

const response = await fetch(`${target}/health`);
const json = bigIntParse<{
  success?: boolean;
  data?: { deploymentBlock: bigint | null };
}>(await response.text());
```

## Reference implementation

```ts
interface BigIntWrapper {
  __bigint__: string;
}

function isBigIntWrapper(value: unknown): value is BigIntWrapper {
  return (
    typeof value === "object" &&
    value !== null &&
    "__bigint__" in value &&
    typeof (value as BigIntWrapper).__bigint__ === "string"
  );
}

const bigIntReplacer = (_key: string, value: unknown): unknown =>
  typeof value === "bigint"
    ? ({ __bigint__: value.toString() } satisfies BigIntWrapper)
    : value;

export const bigIntReviver = (_key: string, value: unknown): unknown =>
  isBigIntWrapper(value) ? BigInt(value.__bigint__) : value;

export const bigIntStringify = (value: unknown): string =>
  JSON.stringify(value, bigIntReplacer);

export const bigIntParse = <T>(value: string): T =>
  JSON.parse(value, bigIntReviver) as T;
```

## Related files

- `<monorepo>/apps/app/src/lib/utils/bigIntJson.ts` — `bigIntReplacer`, `bigIntReviver`, `bigIntStringify`, `bigIntParse`
- `<monorepo>/apps/backend/src/lib/utils/createApiResponse.ts` — wraps API route bodies with `bigIntReplacer`
- `<monorepo>/apps/app/src/lib/utils/createQueryFn.ts` — applies `bigIntReviver` to TanStack Query fetches
- `<monorepo>/apps/app/src/components/AppProviders/ProvidersClient.tsx` — uses `bigIntStringify` / `bigIntParse` for persisted query state and the buster
- `<monorepo>/apps/backend/src/lib/web3/indexer/processKnownBlockchainLog.ts` — persists decoded event args with the replacer

## Related docs

- `@mydaogs/contract` → `ARCH-api-response-wrapper.md`
- `@mydaogs/query` → `ARCH-tanstack-query-integration.md`
- `@mydaogs/indexer` → `ARCH-event-processing-pipeline.md`
