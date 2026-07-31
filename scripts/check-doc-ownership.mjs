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
 * shared-docs, which is exempt from the *pattern* half of this check: describing
 * app architecture is its entire job. It is not exempt from the *index* half —
 * see checkSharedDocsIndexes below.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/**
 * shared-docs ships four indexed folders, and each folder README is the index a
 * reader is told to start from. Exempting the package outright left those four
 * indexes unchecked, and they drifted: the features index listed 31 blueprints
 * while the folder shipped 21, with no pointer saying the other 10 had moved
 * out to their packages. The reader could not act on the entry at all.
 *
 * The index and the folder must agree, with exactly two escapes, both of which
 * have to name where the doc actually is:
 *
 *   `name.md` → `@mydaogs/<package>`   ships with that package
 *   `name.md` → project-authored        no upstream copy; written per project
 *
 * A bare name with no file and no marker is the failure this catches.
 */
const sharedDocsDir = join(packagesDir, "shared-docs");
const INDEXED_FOLDERS = ["rules", "decisions", "features", "units"];
/** `` `name.md` `` in the index, or a markdown link to one. */
const DOC_REF = /(?:`([A-Za-z0-9._/-]+\.md)`|\]\(([A-Za-z0-9._/-]+\.md)(?:#[^)]*)?\))/g;

for (const folder of INDEXED_FOLDERS) {
  const dir = join(sharedDocsDir, folder);
  const readmePath = join(dir, "README.md");

  if (!existsSync(readmePath)) {
    failures.push(`shared-docs/${folder}: no README.md — the folder index is the entry point`);
    continue;
  }

  const onDisk = new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md"),
  );
  const covered = new Set();

  for (const line of readFileSync(readmePath, "utf8").split("\n")) {
    // Both escapes are line-scoped on purpose: the pointer has to sit next to
    // the name it excuses, not somewhere else in the document.
    const namesElsewhere = /@mydaogs\/[a-z-]+|project-authored/.test(line);

    for (const match of line.matchAll(DOC_REF)) {
      const ref = (match[1] ?? match[2]).replace(/^\.\//, "");

      // A reference into another folder is a cross-link, not an index entry.
      // It still has to resolve — from this folder, or from the docs root.
      if (ref.includes("/")) {
        if (!existsSync(join(dir, ref)) && !existsSync(join(sharedDocsDir, ref))) {
          failures.push(`shared-docs/${folder}/README.md: references ${ref}, which does not exist`);
        }
        continue;
      }

      if (onDisk.has(ref)) {
        covered.add(ref);
      } else if (!namesElsewhere) {
        failures.push(
          `shared-docs/${folder}/README.md: indexes ${ref}, which is not in the folder and names no owner ` +
            `(add \`→ @mydaogs/<package>\` or \`→ project-authored\`)`,
        );
      }
    }
  }

  for (const f of onDisk) {
    if (!covered.has(f)) {
      failures.push(`shared-docs/${folder}/${f}: shipped but not indexed in the folder README`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Doc ownership check failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nMove app architecture to shared-docs, rewrite the doc against the package's exports,\n" +
      "or point the index entry at the package that owns it.",
  );
  process.exit(1);
}

console.log("Package docs own only their package, and every shared-docs index agrees with its folder");
