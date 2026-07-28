export type ValueOf<T extends object> = T[keyof T];

/**
 * Infers the dynamic-segment names from a Next.js route literal.
 *
 * `ExtractPathParams<"/entity/[id]/tab/[slug]">` resolves to `"id" | "slug"`,
 * which is what makes `buildDynamicRoutePath` compile-time checked.
 */
export type ExtractPathParams<Path extends string> =
  Path extends `${infer _Start}[${infer Param}]${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : never;

/** Narrows a readonly tuple to "at least one element". */
export type NonEmptyArray<T> = readonly [T, ...T[]];
