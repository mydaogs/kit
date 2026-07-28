import type { ExtractPathParams } from "./types";

/**
 * Builds a concrete URL from a Next.js route template.
 *
 * Prefer this over `.replace("[id]", id)`: the params object is typed from the
 * template literal, so a renamed or missing segment fails `check-types`
 * instead of shipping a literal "[id]" into an href.
 */
export function buildDynamicRoutePath<TPath extends string>(
  path: TPath,
  params: { [K in ExtractPathParams<TPath>]: string },
): string {
  let result = String(path);

  for (const [key, value] of Object.entries(params as Record<string, string>)) {
    result = result.replace(new RegExp(`\\[${key}\\]`, "g"), value);
  }

  return result;
}
