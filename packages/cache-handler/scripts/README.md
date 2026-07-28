# Wiring the distributed cache handler

Three steps. Skipping any of them fails **silently** — the app works, its cache
is process-local, and peer deployments serve stale data indefinitely

## 1. Register the handler in `next.config`

The step most easily missed, because nothing errors without it:

```js
// next.config.mjs
import { fileURLToPath } from "node:url";

const nextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    // A path, not an import: Next loads this outside the app module graph
    default: fileURLToPath(
      new URL("./cache-handlers/distributed.mjs", import.meta.url),
    ),
  },
};
```

The app-local shim supplies the `appName` and the KV client. Both are required —
this package declares no Redis dependency of its own:

```js
// cache-handlers/distributed.mjs
import { createDistributedCacheHandler } from "@mydaogs/cache-handler";
import { kv } from "@mydaogs/kv/rest";

export default createDistributedCacheHandler({ appName: "app", kvClient: kv });
```

`@mydaogs/kv/rest`, never `@mydaogs/kv`. The default entrypoint validates env
eagerly and imports `server-only`; this file is loaded during build-time
tracing, where neither runtime env nor a Server Component context exists. The
`/rest` entrypoint defers construction behind a Proxy

Use the **reader app's own** `appName`. Wiring a writer with a reader's
`appName` mixes LRU keys across deployments

## 2. Trace it into the deployment

Next's tracer cannot discover this handler from route imports, so nothing it
needs reaches the production bundle unless listed explicitly:

```js
outputFileTracingIncludes: {
  "/**/*": [
    "./cache-handlers/**/*",
    "./node_modules/@mydaogs/cache-handler/dist/**",
    "./node_modules/@mydaogs/kv/dist/**",
    // Peers that may not be hoisted to the app — see below
    "../../node_modules/.pnpm/@upstash+redis@*/node_modules/@upstash/redis/**",
    "../../node_modules/.pnpm/uncrypto@*/node_modules/uncrypto/**",
  ],
},
```

Three things about these globs are worth stating, because each has broken a real
deployment:

- **A glob that matches nothing is silent.** It does not warn or fail the build.
  `./node_modules/@upstash/redis/**` resolves only in an app that declares that
  package *itself*; in a pnpm workspace the others reach it through the virtual
  store and the pattern quietly matches zero files. The deployment then ships
  `@mydaogs/kv` without the Redis client it imports. Check every pattern
  resolves from every app, in CI
- **Match `dist/**`, not `**/*` over a package root.** In a pnpm store a package
  directory sits beside its peers', and a broad glob walks into them
- **Do not root a glob at the workspace `node_modules/`.** A stray
  `node_modules/node_modules` symlink there is enough to send the tracer into an
  infinite loop, and it surfaces as an opaque bundler panic rather than anything
  naming these globs

`scripts/check-cache-handlers.mjs` in the kit's `scripts/` directory enforces the
registration and the tracing entry

## No codegen step

This package publishes compiled ESM that Node loads directly, which is exactly
what a cache handler needs. Import it by its bare specifier and trace `dist/**`

If you are following an older guide that has you transpiling this package's
TypeScript into native ESM yourself before wiring it up: that step is gone.
There is nothing to generate

The consuming app must **not** list this package in `transpilePackages` — it is
already plain JavaScript, and the handler is loaded outside that pipeline anyway

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
