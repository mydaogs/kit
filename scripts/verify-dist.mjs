/**
 * Packs every publishable package, installs the tarballs into a throwaway
 * project, and imports each one under plain Node ESM.
 *
 * This exists because `check-types` and `build` between them still let a
 * completely unloadable package through: tsc type-checks the source and emits
 * output, but nothing ever *runs* what was emitted. A `"type": "module"` build
 * with extensionless relative imports type-checks, compiles, publishes, and
 * then throws ERR_MODULE_NOT_FOUND on the consumer's first import.
 *
 * It also covers the only part of packaging that no other check reaches:
 * `publishConfig` substitution. In the workspace, `exports` points at
 * TypeScript source; the compiled `dist/` mapping only materialises inside the
 * tarball, so it is unverifiable without actually packing.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packagesDir = join(root, "packages");

/** Entry subpaths to import, beyond ".", keyed by package name. */
const EXTRA_ENTRIES = { "@mydaogs/kv": ["./rest"] };

/**
 * Entries that must NOT be importable in a bare Node process, with the reason.
 * `server-only` throws by design outside a React Server Component graph, so a
 * successful import here would mean the guard had been lost.
 */
const EXPECTED_TO_THROW = {
  "@mydaogs/kv": "imports `server-only`, which must reject a non-RSC importer",
};

const packages = readdirSync(packagesDir).filter((name) => {
  const manifest = join(packagesDir, name, "package.json");
  try {
    return Boolean(JSON.parse(readFileSync(manifest, "utf8")).scripts?.build);
  } catch {
    return false;
  }
});

if (packages.length === 0) {
  console.error("verify-dist: found no packages with a build script to check");
  process.exit(1);
}

const workdir = mkdtempSync(join(tmpdir(), "mydaogs-verify-dist-"));
const tarballs = join(workdir, "tarballs");
const failures = [];

try {
  // Build first, deliberately. `prepublishOnly` runs on `publish` but NOT on
  // `pack`, so packing straight away would tarball whatever dist/ happened to
  // be on disk — and a stale or missing dist would sail through this check.
  console.log("verify-dist: rebuilding before packing");
  execFileSync("pnpm", ["-r", "build"], { cwd: root, stdio: "pipe" });

  console.log(`verify-dist: packing ${packages.length} packages`);
  for (const name of packages) {
    execFileSync("pnpm", ["pack", "--pack-destination", tarballs], {
      cwd: join(packagesDir, name),
      stdio: "pipe",
    });
  }

  // Each tarball depends on its siblings by version, and those versions are not
  // on the registry during a pre-release check — so every @mydaogs specifier is
  // overridden to the local tarball.
  const files = readdirSync(tarballs);
  const specifiers = Object.fromEntries(
    files.map((file) => {
      const manifest = JSON.parse(
        execFileSync("tar", ["-xzOf", join(tarballs, file), "package/package.json"], {
          encoding: "utf8",
          maxBuffer: 1024 * 1024 * 16,
        }),
      );
      return [manifest.name, `file:${join(tarballs, file)}`];
    }),
  );

  // Peers the packages declare but do not ship, pinned to the workspace's own
  // versions so the probe resolves the same tree CI type-checked against.
  const rootDev = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).devDependencies;
  const peers = ["react", "@tanstack/react-query", "viem", "wagmi", "@upstash/redis", "server-only"];
  const peerDeps = Object.fromEntries(
    peers.filter((p) => rootDev[p]).map((p) => [p, rootDev[p]]),
  );

  writeFileSync(
    join(workdir, "package.json"),
    JSON.stringify(
      {
        name: "verify-dist-probe",
        private: true,
        type: "module",
        dependencies: { ...specifiers, ...peerDeps },
        pnpm: { overrides: specifiers },
      },
      null,
      2,
    ),
  );

  // PNPM_STORE_DIR is an escape hatch for environments where the default
  // global store is not writable from a temp directory (sandboxes, some CI
  // images). Unset, pnpm uses its normal store.
  const installArgs = ["install", "--ignore-workspace"];
  if (process.env.PNPM_STORE_DIR) installArgs.push("--store-dir", process.env.PNPM_STORE_DIR);
  try {
    execFileSync("pnpm", installArgs, { cwd: workdir, stdio: "pipe" });
  } catch (cause) {
    const detail = String(cause.stdout ?? "") + String(cause.stderr ?? "");
    console.error("verify-dist: could not install the packed tarballs\n");
    console.error(detail.trim().split("\n").slice(-12).join("\n"));
    process.exit(1);
  }

  for (const [name] of Object.entries(specifiers)) {
    for (const sub of [".", ...(EXTRA_ENTRIES[name] ?? [])]) {
      const specifier = sub === "." ? name : `${name}/${sub.replace(/^\.\//, "")}`;
      const expectedToThrow = sub === "." && EXPECTED_TO_THROW[name];
      let error = null;
      try {
        execFileSync(
          process.execPath,
          ["--input-type=module", "-e", `await import(${JSON.stringify(specifier)})`],
          { cwd: workdir, stdio: "pipe" },
        );
      } catch (cause) {
        error = String(cause.stderr ?? cause).split("\n").find((l) => l.includes("Error")) ?? "failed";
      }

      if (expectedToThrow && !error) {
        failures.push(`${specifier}: imported cleanly but ${expectedToThrow}`);
      } else if (expectedToThrow) {
        console.log(`  ok  ${specifier} (rejected as designed)`);
      } else if (error) {
        failures.push(`${specifier}: ${error}`);
      } else {
        console.log(`  ok  ${specifier}`);
      }
    }
  }
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\nverify-dist: ${failures.length} package(s) are not loadable as published:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\nverify-dist: all ${packages.length} packages import cleanly as published`);
