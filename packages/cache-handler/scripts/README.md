# Runtime codegen

Next loads a cache handler **outside** the normal app transpilation pipeline,
so the handler must exist as plain `.mjs` with no bare workspace specifiers and
no TypeScript syntax

In the source project this is solved by generating `runtime/*.mjs` from
`src/*.ts` with a `sync-runtime` script (TypeScript transpile + Prettier), and
verifying the generated output is current as part of `check-types`

That script is intentionally not carried here, because this kit's `package.json`
files omit build scripts. To wire it up in a consuming repo:

1. Add a `sync-runtime` script that transpiles `src/*.ts` to `runtime/*.mjs`
   with a generated-file header, rewriting relative imports to `.mjs`
2. Add `--check` mode that fails when the generated output is stale, and call
   it from `check-types`
3. Point the package `exports` map at `runtime/index.mjs` for `import`/`default`
   and at `src/index.ts` for `types`
4. Add `outputFileTracingIncludes` entries in each consuming app for
   `./cache-handlers/**/*`, this package's `runtime/**`, and the KV runtime —
   Next's tracing cannot discover the handler from route imports
