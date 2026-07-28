import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Every module in this package imports React, so the whole bundle is a
  // client boundary. esbuild drops a "use client" that is not already at the
  // top of the entry, and the barrel is generated — so it is re-added here.
  // This is the reason the React modules live in their own package: the
  // directive can cover the entire bundle without wrongly marking isomorphic
  // code as client-only.
  banner: { js: '"use client";' },
});
