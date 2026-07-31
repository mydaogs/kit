#!/usr/bin/env node
/**
 * Enforces the docs tree structure this package prescribes, in the repo that
 * adopted it.
 *
 * Adoption is a copy, and a copy has no upstream to fall back on. Once the
 * placeholders are replaced a copied doc reads as the project's own, so the
 * three things that make the tree navigable — an entry point, a folder index,
 * and a record of what came from the kit — are exactly the three things nobody
 * notices are missing. Each check below is one of them.
 *
 * Usage: check-docs-adoption [docsDir | repoRoot]
 *
 * The argument may be the docs tree itself or the repository root that holds
 * it, because `docs/` sits at the repository root — above the workspaces, not
 * inside one. A repo can hold several workspaces, or none that are npm at all,
 * so the level that owns `docs/` is the only one every project shares.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = resolve(process.argv[2] ?? "docs");

/**
 * Accept either level. Pointing at a repo root and being told "no docs
 * directory" is a worse failure than just looking one level in.
 */
const docsDir =
  basename(target) !== "docs" && existsSync(join(target, "docs"))
    ? join(target, "docs")
    : target;

/**
 * This script ships next to the folders it checks against, so it knows exactly
 * which docs the kit carries — at the version the project actually resolved,
 * not at the version someone wrote into a list once.
 */
const kitDir = dirname(fileURLToPath(import.meta.url));

/** Folders carried from the kit. Each keeps a record of what it inherited. */
const CARRIED_FOLDERS = ["rules", "decisions", "features", "units"];

/** Folders the kit deliberately does not ship, and every project needs. */
const REQUIRED_LOCAL_FOLDERS = ["product", "runbooks"];

/** Decisions that are project-specific by nature and have no upstream copy. */
const REQUIRED_LOCAL_DECISIONS = [
  "data-models.md",
  "blockchain.md",
  "integrations.md",
  "non-goals.md",
];

/**
 * Placeholders that name a path or a slug. A project has its own answer for
 * every one of these, so a survivor means a copied doc was never adapted and is
 * now pointing at a directory that does not exist.
 *
 * The identifier placeholders from the adoption table (`APP_TAGS`, `Entity`,
 * `OWNER_ROLE`, `BACKEND_CONTRACT_VERSION`, the chain names) are deliberately
 * absent: a project may legitimately keep those names verbatim, so flagging
 * them would train people to ignore this check.
 */
const PLACEHOLDERS = [
  { re: /<monorepo>/, why: "<monorepo>" },
  { re: /<contracts>/, why: "<contracts>" },
  { re: /<project>/, why: "<project>" },
  { re: /<provider>/, why: "<provider>" },
  { re: /\bapps\/app\b/, why: "apps/app" },
];

/**
 * Quoting the kit's own wording is not residue. The ownership record exists to
 * say "upstream states this against `<monorepo>`, here it is named" — which
 * cannot be written without the placeholder in it.
 */
const DISCUSSES_UPSTREAM = /@mydaogs|\bkit\b/;

/** `` `name.md` `` in an index, or a markdown link to one. */
const DOC_REF = /(?:`([A-Za-z0-9._/-]+\.md)`|\]\(([A-Za-z0-9._/-]+\.md)(?:#[^)]*)?\))/g;

const failures = [];

function listDir(dir) {
  return readdirSync(dir, { withFileTypes: true });
}

if (!existsSync(docsDir) || !statSync(docsDir).isDirectory()) {
  // A guard that cannot tell "no violations" from "scanned nothing" reports
  // success forever after a directory move. Fail loudly instead.
  console.error(
    `Docs adoption check failed: no docs directory at ${docsDir}\n` +
      `Pass the correct path: node check-docs-adoption.mjs <docsDir>`,
  );
  process.exit(1);
}

const subFolders = listDir(docsDir)
  .filter((e) => e.isDirectory() && !e.name.startsWith("."))
  .map((e) => e.name);

/**
 * 0. The layout itself.
 *
 * `docs/` belongs at the repository root, beside the workspaces rather than
 * inside one. A tree that sits inside a workspace is invisible to the other
 * workspaces and moves when that one is restructured; a second tree inside a
 * workspace splits the answer to "where is this documented", and the copy
 * nobody opens is the one that goes stale.
 *
 * This is the rule that protects the shape, and it is the one no amount of
 * index discipline can recover once broken.
 */
const repoRoot = dirname(docsDir);

if (!existsSync(join(repoRoot, ".git"))) {
  failures.push(
    `${docsDir}: not at the repository root — docs/ belongs beside the workspaces, not inside one`,
  );
}

/** A nested repo or submodule carries its own docs, and they are not ours to police. */
function isForeignTree(dir, name) {
  if (name === "node_modules" || name.startsWith(".")) return true;
  return existsSync(join(dir, ".git"));
}

function findStrayDocs(dir, out = []) {
  for (const entry of listDir(dir)) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (full === docsDir) continue;
    if (isForeignTree(full, entry.name)) continue;
    if (entry.name === "docs") {
      out.push(full);
      continue;
    }
    findStrayDocs(full, out);
  }
  return out;
}

for (const stray of findStrayDocs(repoRoot)) {
  failures.push(
    `${stray.slice(repoRoot.length + 1)}/: a second docs tree — the root docs/ is the only one, ` +
      `and a package documents itself in root-level markdown beside its package.json instead`,
  );
}

// 1. One entry point, linking every folder. Without it the tree has as many
//    starting points as it has folders, and agents told to "start at docs" pick
//    one at random.
const rootReadmePath = join(docsDir, "README.md");
if (!existsSync(rootReadmePath)) {
  failures.push("README.md: missing — the docs tree needs one entry point");
} else {
  const rootReadme = readFileSync(rootReadmePath, "utf8");
  for (const folder of subFolders) {
    if (!rootReadme.includes(`${folder}/README.md`)) {
      failures.push(`README.md: does not link ${folder}/README.md`);
    }
  }
}

// 2. Every folder indexes itself, and the index agrees with the folder.
for (const folder of subFolders) {
  const dir = join(docsDir, folder);
  const readmePath = join(dir, "README.md");

  if (!existsSync(readmePath)) {
    failures.push(`${folder}/: no README.md — every folder indexes its own contents`);
    continue;
  }

  const onDisk = new Set(
    listDir(dir)
      .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md")
      .map((e) => e.name),
  );
  const readme = readFileSync(readmePath, "utf8");
  const referenced = new Set(
    [...readme.matchAll(DOC_REF)].map((m) => (m[1] ?? m[2]).replace(/^\.\//, "")),
  );

  for (const file of onDisk) {
    if (!referenced.has(file)) {
      failures.push(`${folder}/${file}: present but not indexed in ${folder}/README.md`);
    }
  }

  // 3. The ownership record. A carried folder must say which of its docs came
  //    from the kit and which upstream file each one tracks, or a fix that
  //    belongs upstream gets made locally and is lost on the next adoption.
  //
  //    Testing for the string `@mydaogs/` anywhere in the file is not enough:
  //    the kit's own indexes carry `→ @mydaogs/<package>` markers for docs that
  //    ship with a package, so a raw unedited copy would pass with no record at
  //    all. A real record maps a doc that is *here* to the upstream file it
  //    tracks, so the doc name and the package have to be tied together — on
  //    the line, or by the heading the line sits under, since naming the
  //    package once per section beats repeating it on every table row.
  if (!CARRIED_FOLDERS.includes(folder)) continue;

  const kitFolder = join(kitDir, folder);
  const kitFiles = existsSync(kitFolder)
    ? new Set(readdirSync(kitFolder).filter((f) => f.endsWith(".md") && f !== "README.md"))
    : new Set();

  const inherited = [...onDisk].filter((f) => kitFiles.has(f));
  if (inherited.length === 0) continue;

  const recordLines = [];
  let sectionNamesKit = false;
  for (const line of readme.split("\n")) {
    if (line.startsWith("#")) sectionNamesKit = line.includes("@mydaogs/");
    if (sectionNamesKit || line.includes("@mydaogs/")) recordLines.push(line);
  }

  const unaccounted = inherited.filter((f) => !recordLines.some((line) => line.includes(f)));

  if (unaccounted.length > 0) {
    const shown = unaccounted.slice(0, 8).join(", ");
    const rest = unaccounted.length > 8 ? `, +${unaccounted.length - 8} more` : "";
    failures.push(
      `${folder}/README.md: carried from the kit but absent from the ownership record — ${shown}${rest}. ` +
        `List each against the '@mydaogs/<package> → <file>' it tracks, and say which side to edit`,
    );
  }
}

// 4. The folders the kit does not ship. Their absence is silent: nothing in a
//    copied tree refers to them.
for (const folder of REQUIRED_LOCAL_FOLDERS) {
  if (!subFolders.includes(folder)) {
    failures.push(`${folder}/: missing — the kit ships no copy, so every project writes its own`);
  }
}

// 5. The four decisions no kit can make for a project.
if (subFolders.includes("decisions")) {
  for (const file of REQUIRED_LOCAL_DECISIONS) {
    if (!existsSync(join(docsDir, "decisions", file))) {
      failures.push(`decisions/${file}: missing — required and project-specific`);
    }
  }
}

// 6. Placeholder residue.
function walkMarkdown(dir, out = []) {
  for (const entry of listDir(dir)) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

for (const file of walkMarkdown(docsDir)) {
  const rel = file.slice(docsDir.length + 1);
  const lines = readFileSync(file, "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    if (DISCUSSES_UPSTREAM.test(line)) continue;
    for (const { re, why } of PLACEHOLDERS) {
      if (re.test(line)) {
        failures.push(`${rel}:${index + 1}: unreplaced placeholder ${why}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Docs adoption check failed (${failures.length}):\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    `\nSee @mydaogs/shared-docs → rules/docs-rules.md for the structure these checks enforce.`,
  );
  process.exit(1);
}

console.log(`Docs adoption check passed (${subFolders.length} folder(s) under ${docsDir})`);
