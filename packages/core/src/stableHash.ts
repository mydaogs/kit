/**
 * Deterministic, bigint-safe hash of an arbitrary query key.
 *
 * `JSON.stringify` cannot be used: it throws `Do not know how to serialize a
 * BigInt`, and wallet-library query keys routinely carry bigints (chain ids,
 * amounts, block numbers). Using it to dedupe invalidation keys turns every
 * confirmed transaction into a reconciliation failure.
 *
 * Object keys are sorted so two structurally equal keys hash identically
 * regardless of construction order — the property dedupe actually needs.
 */
export function stableHash(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const type = typeof value;

  if (type === "bigint") return `${(value as bigint).toString()}n`;
  if (type === "number" || type === "boolean") return String(value);
  if (type === "string") return JSON.stringify(value);
  if (type === "symbol" || type === "function") return String(value);

  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }

  if (value instanceof Date) return `Date(${value.getTime()})`;
  if (value instanceof Map) {
    return `Map(${serialize([...value.entries()])})`;
  }
  if (value instanceof Set) {
    return `Set(${serialize([...value])})`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(",")}}`;
}
