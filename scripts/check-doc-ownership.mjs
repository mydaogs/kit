/**
 * Enforces the single-source-of-truth rule for package documentation.
 *
 * A doc shipped with a package must describe *that package*: its exported API
 * and the invariants behind it. The moment it starts naming a consuming app's
 * directories or a symbol the package does not export, it stops being package
 * documentation and becomes a copy of somebody's app architecture — which then
 * rots independently of both.
 *
 * That is not hypothetical. Every one of these documents was extracted from a
 * product repository, and the first version of the extraction carried the app's
 * paths, its `@shared/*` package names, and a build step that no longer exists
 * straight into the published tarballs.
 *
 * Cross-cutting patterns that genuinely belong to no single package live in
 * shared-docs, which is exempt: describing app architecture is its entire job.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const packagesDir = resolve(import.meta.dirname, "..", "packages");
const EXEMPT = new Set(["shared-docs"]);

/** Patterns that mean "this is describing an app, not this package". */
const FORBIDDEN = [
  { re: /<monorepo>/g, why: "monorepo path placeholder" },
  { re: /\bapps\/[a-z0-9-]+/gi, why: "consuming app directory" },
  { re: /motherhunt/gi, why: "product name" },
  { re: /@shared\//g, why: "pre-extraction package scope" },
  { re: /\bruntime\/\*?\.?mjs\b/g, why: "retired codegen output" },
  { re: /\bsync-runtime\b/g, why: "retired codegen script" },
];

const failures = [];

for (const pkg of readdirSync(packagesDir)) {
  if (EXEMPT.has(pkg)) continue;
  const dir = join(packagesDir, pkg);

  let entries;
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    continue;
  }

  // Nested markdown ships too, and is easier to forget precisely because it is
  // out of sight: cache-handler/scripts/README.md kept describing a codegen
  // step that had been deleted, and went out in three releases because this
  // check only looked at package roots.
  const nested = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => relative(dir, join(e.parentPath ?? e.path, e.name)))
    // Only our own nested docs. An installed dependency's CHANGELOG is not ours
    // to police, and node_modules is not published anyway.
    .filter((f) => f.includes("/") && !f.split("/").includes("node_modules"));

  const allDocs = [...entries, ...nested];
  if (allDocs.length === 0) continue;

  for (const file of allDocs) {
    const text = readFileSync(join(dir, file), "utf8");
    for (const { re, why } of FORBIDDEN) {
      const hits = [...text.matchAll(re)];
      if (hits.length > 0) {
        failures.push(
          `${pkg}/${file}: ${hits.length} × ${why} (${JSON.stringify(hits[0][0])})`,
        );
      }
    }
  }

  // The README's doc list and the shipped files must agree. A doc that exists
  // but is unlisted is unreachable; a listed doc that does not exist is a dead
  // link on npm.
  const readme = entries.includes("README.md")
    ? readFileSync(join(dir, "README.md"), "utf8")
    : "";
  const listed = new Set(
    [...readme.matchAll(/\]\(\.\/([A-Za-z0-9._-]+\.md)\)/g)].map((m) => m[1]),
  );
  const onDisk = new Set(entries.filter((f) => f !== "README.md"));

  for (const f of onDisk) {
    if (!listed.has(f)) failures.push(`${pkg}/${f}: shipped but not linked from README`);
  }
  for (const f of listed) {
    if (!onDisk.has(f)) failures.push(`${pkg}/README.md: links ${f}, which does not exist`);
  }
}

if (failures.length > 0) {
  console.error(`Package docs describe things the package does not own (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nMove app architecture to shared-docs, or rewrite the doc against the package's exports.",
  );
  process.exit(1);
}

console.log("Package docs own only their package");
