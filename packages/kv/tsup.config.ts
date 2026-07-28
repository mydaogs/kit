import { defineConfig } from "tsup";

export default defineConfig({
  // Two entries sharing one chunk, so `@mydaogs/kv` and `@mydaogs/kv/rest`
  // resolve to the SAME lazy client instance. Bundled independently they
  // would each inline their own singleton.
  entry: ["src/index.ts", "src/rest.ts"],
  format: ["esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
});
