# Wiring the distributed cache handler

Three steps. Skipping any of them fails **silently** — the app works, its cache
is process-local, and peer deployments serve stale data indefinitely

## 1. Register the handler in `next.config`

This is the step most easily missed, because nothing errors without it:

```js
// next.config.mjs
const nextConfig = {
  cacheComponents: true,
  experimental: {
    cacheHandlers: {
      // Path, not an import: Next loads this outside the app module graph
      default: require.resolve("./cache-handlers/distributed.mjs"),
    },
  },
  outputFileTracingIncludes: {
    // Next's tracing cannot discover the handler from route imports, so the
    // production bundle omits it unless it is listed explicitly
    "/**": [
      "./cache-handlers/**/*",
      "../../node_modules/@kit/cache-handler/runtime/**",
      "../../node_modules/@kit/kv/runtime/**",
      "../../node_modules/@upstash/redis/**",
    ],
  },
};
```

The app-local shim supplies the `appName` and the KV singleton:

```js
// cache-handlers/distributed.mjs
import { createDistributedCacheHandler } from "../../../node_modules/@kit/cache-handler/runtime/index.mjs";
import { kv } from "../../../node_modules/@kit/kv/runtime/rest.mjs";

export default createDistributedCacheHandler({ appName: "app", kvClient: kv });
```

Use the **reader app's own** `appName`. Wiring a writer app with a reader's
`appName` mixes LRU keys across deployments

`scripts/check-cache-handlers.mjs` in the kit's `scripts/` directory enforces
both the registration and the tracing entry

## 2. Generate the `.mjs` runtime

Next loads a cache handler **outside** the normal transpilation pipeline, so the
handler must exist as plain `.mjs` with no bare workspace specifiers and no
TypeScript syntax

In a consuming repo:

1. Add a `sync-runtime` script that transpiles `src/*.ts` to `runtime/*.mjs`
   with a generated-file header, rewriting relative imports to `.mjs`
2. Add `--check` mode that fails when the generated output is stale, and call
   it from `check-types`
3. Point the package `exports` map at `runtime/index.mjs` for `import`/`default`
   and at `src/index.ts` for `types`

Build scripts are intentionally absent from this kit, so the script is not
shipped here

## 3. Decide whether you need delivery acknowledgement

`updateTags` wraps its Redis pipeline in try/catch and logs. That is deliberate —
a cache bump must not fail a user's write — but it means **same-app peer delivery
is not observable through `revalidateTag` alone**. The call can fail invisibly

Most writes are fine with that. A write whose *durable* state depends on the
invalidation having landed is not. The pattern for those:

```ts
// Ordinary write: fire and forget, log on failure
revalidateTag(APP_TAGS.entity(id), { expire: 0 });

// State-gating write: publish to your own appName and AWAIT it, so a Redis
// outage surfaces before the terminal status is committed
await publishCacheInvalidation({
  kvClient: kv,
  targetAppName: "app",       // your own app, not a peer
  tags: [APP_TAGS.entity(id)],
  mode: "expire",
});
await commitTerminalStatus();
```

Publishing a namespace the handler also writes is idempotent — it is the same
`:tag:{tag}` / `:tag-bumps` key pair. The only difference is that the publisher
propagates errors while the handler swallows them

Order matters: flush only **after** the final status write has landed, or a
concurrent reader repopulates the cache from the pre-transition row
