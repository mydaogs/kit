/**
 * JSON serialization helpers for BigInt values.
 *
 * Uses a tagged object wrapper to preserve type information and avoid the
 * false positives a plain `toString()` convention produces: a decimal string
 * in the payload is indistinguishable from a serialized bigint, so a reviver
 * cannot tell them apart. The wrapper makes the round-trip lossless.
 *
 * Never reinstall a global `BigInt.prototype.toJSON`. `JSON.stringify` invokes
 * `toJSON` *before* the replacer, so such an override silently flattens
 * bigints to plain strings and breaks the round-trip.
 */

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

export const bigIntReplacer = (_key: string, value: unknown): unknown => {
  if (typeof value === "bigint") {
    return { __bigint__: value.toString() } satisfies BigIntWrapper;
  }
  return value;
};

export const bigIntReviver = (_key: string, value: unknown): unknown => {
  if (isBigIntWrapper(value)) {
    return BigInt(value.__bigint__);
  }
  return value;
};

export const bigIntStringify = (value: unknown): string =>
  JSON.stringify(value, bigIntReplacer);

export const bigIntParse = <T>(value: string): T =>
  JSON.parse(value, bigIntReviver) as T;

/**
 * Defensive coercion for wire numerics. Chain-decoded args may arrive as a
 * bigint, a plain decimal string (a row persisted before the wrapper protocol,
 * or a producer outside it), or a number. A strict `typeof === "bigint"` check
 * used as a validator silently drops those rows, so coerce instead.
 */
export const toBigInt = (value: unknown): bigint | null => {
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
