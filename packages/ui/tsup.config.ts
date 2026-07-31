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
  // lands on the RSC-safe build. They reach primitives owned by a different
  // entry through the package's own bare specifiers ("@mydaogs/ui",
  // "@mydaogs/ui/client", ...), which `external` keeps unbundled — Node
  // resolves them via self-reference at runtime, so no entry ever carries a
  // second copy of a primitive already shipped by another one. `form` is a
  // separate entry (not folded into `client`) specifically so importing
  // anything from "@mydaogs/ui/client" never forces react-hook-form to be
  // installed — form.tsx has a top-level react-hook-form import, and a single
  // bundled entry evaluates every top-level import in the file regardless of
  // which export a consumer actually uses.
  {
    entry: { client: "src/client.ts", next: "src/next.ts", form: "src/form-entry.ts" },
    ...base,
    clean: false,
    banner: { js: '"use client";' },
    external: ["@mydaogs/ui", "@mydaogs/ui/client", "@mydaogs/ui/next", "@mydaogs/ui/form"],
  },
]);
