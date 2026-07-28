# TypeScript types

## Locations

- `<monorepo>/apps/*/src/app/**/_widgets/**` - non reusable and route scoped types colocated with usage
- `<monorepo>/apps/*/src/lib/types/` - reusable within an app and re-exported via `index.ts`
- `<monorepo>/apps/*/src/types/` - app-local ambient type augmentations
- `<monorepo>/packages/ui/src/lib/types/` - reusable across apps and re-exported via `index.ts`
- `<monorepo>/packages/utils/src/` - reusable pure utility types shared across apps and re-exported via `index.ts`

## Units files lists (file path + one sentence short description)

### Non-Reusable

<!-- route-scoped types colocated under _widgets/ -->

### Reusable within an app

<!-- types under apps/<app>/src/lib/types/ -->

### Reusable across apps

`packages/utils/src/types.ts` carries two type helpers worth keeping in every project:

```ts
export type ValueOf<T extends object> = T[keyof T];

export type ExtractPathParams<Path extends string> =
  Path extends `${infer _Start}[${infer Param}]${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : never;
```

`ExtractPathParams` infers param names from a route literal, which is what makes `buildDynamicRoutePath("/entity/[id]", { id })` compile-time checked
