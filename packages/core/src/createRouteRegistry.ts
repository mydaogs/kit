import { buildDynamicRoutePath } from "./buildDynamicRoutePath";
import type { ExtractPathParams } from "./types";

export interface RouteDefinition {
  href: string;
  /** Optional i18n key for a route-title registry. */
  titleKey?: string;
}

export type RouteRegistry = Record<string, RouteDefinition>;

/**
 * Wraps a route registry with a typed path builder.
 *
 * The registry itself stays a plain `as const` object owned by the app — this
 * only adds the lookup + param-checked interpolation on top, so route configs
 * remain greppable and diffable.
 *
 * ```ts
 * const ROUTES = {
 *   ENTITY: { href: "/entity/[id]" },
 *   LIST: { href: "/entity" },
 * } as const;
 *
 * const routes = createRouteRegistry(ROUTES);
 * routes.path("ENTITY", { id: "abc" }); // "/entity/abc"
 * routes.path("LIST");                  // "/entity"
 * ```
 */
export function createRouteRegistry<T extends RouteRegistry>(registry: T) {
  type Key = keyof T & string;

  function path<K extends Key>(
    key: K,
    ...args: ExtractPathParams<T[K]["href"]> extends never
      ? []
      : [params: { [P in ExtractPathParams<T[K]["href"]>]: string }]
  ): string {
    const href = registry[key]!.href;
    const params = args[0];
    if (!params) return href;
    return buildDynamicRoutePath(
      href,
      params as { [P in ExtractPathParams<typeof href>]: string },
    );
  }

  return { registry, path };
}
