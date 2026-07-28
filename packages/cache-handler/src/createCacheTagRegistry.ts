/**
 * Cache tags as a typed registry rather than inline template strings.
 *
 * Producers (write routes, indexer handlers, cron) and consumers (cached data
 * functions) must agree on the exact tag string. A shared `as const` map makes
 * a rename a compile error on both sides instead of a silent no-op
 * invalidation that nobody notices until the data is stale in production.
 *
 * ```ts
 * export const APP_TAGS = createCacheTagRegistry({
 *   ENTITY: (id: string) => `entity:${id}`,
 *   ENTITY_LIST: "entity:list",
 * });
 *
 * APP_TAGS.ENTITY("abc");   // "entity:abc"
 * APP_TAGS.ENTITY_LIST;     // "entity:list"
 * ```
 */
export type CacheTagDefinition =
  | string
  | ((...args: never[]) => string);

export type CacheTagRegistry = Record<string, CacheTagDefinition>;

export function createCacheTagRegistry<const T extends CacheTagRegistry>(
  registry: T,
): T {
  return registry;
}

/** Deduplicates a tag list before publishing. */
export const dedupeTags = (tags: readonly string[]): string[] => [
  ...new Set(tags),
];

/**
 * Splits a flat tag list into the tier that may travel in an HTTP response
 * envelope and the tier that must only be flushed server-side.
 *
 * The envelope is visible to the caller, so it may only carry tags the caller
 * is already entitled to know about. A tag parameterized by another
 * principal's id leaks that id, so it stays internal.
 */
export function partitionTags(
  tags: readonly string[],
  isCallerScoped: (tag: string) => boolean,
): { envelope: string[]; internal: string[] } {
  const envelope: string[] = [];
  const internal: string[] = [];
  for (const tag of dedupeTags(tags)) {
    (isCallerScoped(tag) ? envelope : internal).push(tag);
  }
  return { envelope, internal };
}
