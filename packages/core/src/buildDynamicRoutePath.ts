import type { ExtractPathParams } from "./types";

const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

const escapeRegExp = (value: string): string =>
  value.replace(REGEX_METACHARACTERS, "\\$&");

export interface BuildDynamicRoutePathOptions {
  /**
   * Percent-encode each value as a single path segment. Off by default so a
   * value that is legitimately multi-segment (a catch-all) still works, but
   * turn it on for anything user-supplied.
   */
  encode?: boolean;
}

/**
 * Builds a concrete URL from a Next.js route template.
 *
 * Prefer this over `.replace("[id]", id)`: the params object is typed from the
 * template literal, so a renamed or missing segment fails `check-types`
 * instead of shipping a literal "[id]" into an href.
 *
 * Two hazards this handles that a naive `replace` does not:
 *
 * - **`$` in the value.** `String.replace` treats the replacement as a pattern,
 *   so `$&`, `` $` ``, `$'` and `$1` expand against the match. A value of
 *   `"a$&b"` would produce `/u/a[id]b`. A function replacer is substituted
 *   literally and sidesteps the whole grammar.
 * - **Regex metacharacters in the segment name.** A catch-all like
 *   `[...slug]` contains `.` and would otherwise be compiled as a wildcard.
 *
 * Values are not encoded by default — pass `{ encode: true }` for anything
 * user-supplied, since a raw `/` or `..` in a value otherwise traverses.
 */
export function buildDynamicRoutePath<TPath extends string>(
  path: TPath,
  params: { [K in ExtractPathParams<TPath>]: string },
  options: BuildDynamicRoutePathOptions = {},
): string {
  let result = String(path);

  for (const [key, value] of Object.entries(params as Record<string, string>)) {
    const replacement = options.encode ? encodeURIComponent(value) : value;
    result = result.replace(
      new RegExp(`\\[${escapeRegExp(key)}\\]`, "g"),
      () => replacement,
    );
  }

  return result;
}
