import { defineConfig } from "tsup";

const base = {
  format: ["esm"],
  dts: true,
  sourcemap: true,
  target: "es2022",
  splitting: true,
} as const;

export default defineConfig([
  // RSC-safe entry: no "use client" banner, importable from a server component.
  {
    entry: { index: "src/index.ts" },
    ...base,
    clean: true,
  },
  // Interactive entries. Bundled separately so the "use client" banner never
  // lands on the RSC-safe build. They reach index.ts's primitives through the
  // package's own bare specifier ("@mydaogs/ui"), which `external` keeps
  // unbundled — Node resolves it via self-reference at runtime, so client.js
  // never carries a second copy of a primitive already shipped in index.js.
  {
    entry: { client: "src/client.ts", next: "src/next.ts" },
    ...base,
    clean: false,
    banner: { js: '"use client";' },
    external: ["@mydaogs/ui"],
  },
]);
