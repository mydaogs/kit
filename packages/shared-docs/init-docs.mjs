#!/usr/bin/env node
/**
 * Scaffolds the docs tree this package prescribes, in a repo that has none.
 *
 * Adoption used to be eight manual steps, and the one people skip is the one a
 * script can do perfectly: the ownership record. Nothing about a copied doc
 * says where it came from, and by the time anyone notices, a fix that belonged
 * upstream has been made locally and is lost at the next adoption. This knows
 * exactly which files it copied and from which version, so it writes that
 * record instead of asking someone to remember to.
 *
 * Usage: init-docs [targetDir]
 *
 * Idempotent. Nothing already present is overwritten, so a re-run after adding
 * a workspace fills only what is missing and reports what it left alone. What
 * it cannot do is decide the project's own content — placeholders stay as
 * placeholders, and `check-docs-adoption` enumerates what is left.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const kitDir = dirname(fileURLToPath(import.meta.url));
const kitVersion = JSON.parse(readFileSync(join(kitDir, "package.json"), "utf8")).version;

const targetRoot = resolve(process.argv[2] ?? ".");
const docsDir = join(targetRoot, "docs");

const CARRIED_FOLDERS = ["rules", "decisions", "features", "units"];
const created = [];
const skipped = [];

function note(list, what) {
  list.push(what);
}

if (!existsSync(targetRoot)) {
  console.error(`init-docs failed: no directory at ${targetRoot}`);
  process.exit(1);
}

// The docs tree belongs at the repository root, beside the workspaces. Landing
// it inside one is the single mistake that cannot be recovered by any later
// check, so refuse rather than scaffold into the wrong place.
if (!existsSync(join(targetRoot, ".git"))) {
  console.error(
    `init-docs failed: ${targetRoot} is not a repository root (no .git)\n` +
      `docs/ belongs at the root, beside the workspaces rather than inside one.\n` +
      `Run this from the repository root, or pass it: init-docs <repoRoot>`,
  );
  process.exit(1);
}

mkdirSync(docsDir, { recursive: true });

// 1. The four carried folders, verbatim.
for (const folder of CARRIED_FOLDERS) {
  const dest = join(docsDir, folder);
  if (existsSync(dest)) {
    note(skipped, `docs/${folder}/`);
    continue;
  }
  cpSync(join(kitDir, folder), dest, { recursive: true });
  note(created, `docs/${folder}/`);
}

// 2. The entry point, with the template's own instructions stripped. Everything
//    above the first horizontal rule addresses the person adopting it, not the
//    person who will read the result.
const readmePath = join(docsDir, "README.md");
if (existsSync(readmePath)) {
  note(skipped, "docs/README.md");
} else {
  const template = readFileSync(join(kitDir, "docs-readme-template.md"), "utf8");
  const lines = template.split("\n");
  const rule = lines.findIndex((line) => line.trim() === "---");
  writeFileSync(readmePath, lines.slice(rule < 0 ? 0 : rule + 1).join("\n").trimStart());
  note(created, "docs/README.md");
}

// 3. The folders the kit deliberately does not ship. Their absence is silent:
//    nothing in a copied tree refers to them.
const LOCAL_FOLDERS = {
  product: {
    title: "Product Guideline",
    blurb: "Domain entities, user types, vision, and the workflows the product promises",
    listHeading: "Product docs list (file name + one sentence short description)",
    suggestion: "vision.md, glossary.md, user-types.md",
  },
  runbooks: {
    title: "Runbooks",
    blurb:
      "Operational procedures — one-time environment setup and the repeatable steps behind deploys, database management, and integrations",
    listHeading: "Runbooks list (file name + when to use it)",
    suggestion: "ci-setup.md, deploy-*.md, manage-databases-per-environment.md",
  },
};

for (const [folder, meta] of Object.entries(LOCAL_FOLDERS)) {
  const dest = join(docsDir, folder);
  const readme = join(dest, "README.md");
  if (existsSync(readme)) {
    note(skipped, `docs/${folder}/README.md`);
    continue;
  }
  mkdirSync(dest, { recursive: true });
  writeFileSync(
    readme,
    `# ${meta.title}\n\n${meta.blurb}\n\n` +
      `The kit ships no copy of this folder — it is project-specific by nature\n\n` +
      `## Rules for working with these docs\n\n` +
      `- Every doc in this folder must be listed below with its file name and a one-sentence description, so the index and the folder never disagree\n\n` +
      `## ${meta.listHeading}\n\n` +
      `Nothing here yet. Likely first entries: ${meta.suggestion}\n`,
  );
  note(created, `docs/${folder}/README.md`);
}

// 4. The four decisions no kit can make for a project. Each stub states what
//    the doc has to answer, because an empty file gets deleted and a file that
//    names its questions gets filled.
const LOCAL_DECISIONS = {
  "data-models.md": {
    title: "Data models",
    questions: [
      "Which offchain entities exist, and what does each own",
      "Which relationships are enforced in the database and which only in application code",
      "Which fields are denormalized, and what keeps them consistent",
      "Which records are user-owned, and what happens to them when the user is removed",
    ],
  },
  "blockchain.md": {
    title: "Blockchain",
    questions: [
      "Which contracts exist, and what state each one owns",
      "Which chains are targeted, and which is authoritative for each environment",
      "Which operations are onchain and which are offchain, and why the line sits there",
      "How onchain state reaches the offchain store, and what happens when the two disagree",
    ],
  },
  "integrations.md": {
    title: "Integrations",
    questions: [
      "Which third-party services are depended on, and what each one is the source of truth for",
      "What the failure behaviour is when one is unavailable",
      "Which of them hold user data, and under what basis",
      "What replacing one would cost, and which are deliberately easy to swap",
    ],
  },
  "non-goals.md": {
    title: "Non-goals",
    questions: [
      "What is explicitly not being built, and what would have to change for that to be revisited",
      "Which plausible-sounding features are refused on purpose, and why",
      "Which scale, locale, or platform targets are out of scope for now",
    ],
  },
};

for (const [file, meta] of Object.entries(LOCAL_DECISIONS)) {
  const dest = join(docsDir, "decisions", file);
  if (existsSync(dest)) {
    note(skipped, `docs/decisions/${file}`);
    continue;
  }
  writeFileSync(
    dest,
    `# ${meta.title}\n\n` +
      `This decision has no upstream copy — it is required and project-specific\n\n` +
      `## What this doc answers\n\n` +
      meta.questions.map((q) => `- ${q}`).join("\n") +
      `\n\n## Decision\n\nNot written yet\n`,
  );
  note(created, `docs/decisions/${file}`);
}

// 5. The ownership record, generated from what was actually copied. This is the
//    step the whole script exists for.
for (const folder of CARRIED_FOLDERS) {
  const dest = join(docsDir, folder);
  const readmePath = join(dest, "README.md");
  if (!existsSync(readmePath)) continue;

  const readme = readFileSync(readmePath, "utf8");
  if (readme.includes("## Upstream counterparts")) {
    note(skipped, `docs/${folder}/README.md ownership record`);
    continue;
  }

  const inherited = readdirSync(join(kitDir, folder))
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .filter((f) => existsSync(join(dest, f)))
    .sort();

  if (inherited.length === 0) continue;

  const rows = inherited
    .map((f) => `| \`${f}\` | \`@mydaogs/shared-docs\` → \`${folder}/${f}\` |`)
    .join("\n");

  const section =
    `## Upstream counterparts\n\n` +
    `${inherited.length} of the docs below came from \`@mydaogs/shared-docs\` (adopted at ${kitVersion}). ` +
    `This tree is not redundant with the kit and is not a mirror to be collapsed: upstream states each one ` +
    `against placeholders, and a doc is only actionable once it names the thing you actually edit, so the ` +
    `local copy carries this project's paths, entities, and tooling\n\n` +
    `**A fix to the rule itself belongs upstream; a fix to how this project binds it belongs here.** ` +
    `When the two disagree on package behaviour the kit wins and the local copy is stale — check the ` +
    `version actually resolved in the lockfile\n\n` +
    `| Local | Upstream file |\n| --- | --- |\n${rows}\n\n` +
    `An entry in the list below marked \`→ @mydaogs/<package>\` is not in this folder at all: it ships ` +
    `with that package and is read at its root\n`;

  // Straight after the H1, which is where a reader starts.
  const lines = readme.split("\n");
  const h1 = lines.findIndex((line) => line.startsWith("# "));
  lines.splice(h1 + 1, 0, "", section.trimEnd());
  writeFileSync(readmePath, lines.join("\n"));
  note(created, `docs/${folder}/README.md ownership record (${inherited.length} docs)`);
}

// 6. The scripts that gate all of the above. The manifest is the consumer's, so
//    only fill what is absent.
const manifestPath = join(targetRoot, "package.json");
if (existsSync(manifestPath)) {
  const raw = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  manifest.scripts ??= {};
  let changed = false;

  for (const [name, command] of [
    ["check:docs", "check-docs-adoption docs"],
    ["check:docs-links", "check-docs-links docs"],
  ]) {
    if (manifest.scripts[name]) {
      note(skipped, `package.json scripts.${name}`);
      continue;
    }
    manifest.scripts[name] = command;
    changed = true;
    note(created, `package.json scripts.${name}`);
  }

  if (changed) {
    const indent = /^\s+"/m.exec(raw)?.[0].slice(1, -1) ?? "  ";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, indent)}\n`);
  }
} else {
  note(skipped, "package.json (none at the repository root — create one with `pnpm init`)");
}

console.log(`Scaffolded a docs tree from @mydaogs/shared-docs@${kitVersion}\n`);
if (created.length > 0) {
  console.log("Created:");
  for (const item of created) console.log(`  + ${item}`);
}
if (skipped.length > 0) {
  console.log(`${created.length > 0 ? "\n" : ""}Left alone (already present):`);
  for (const item of skipped) console.log(`  = ${item}`);
}

console.log(
  `\nNext, in order:\n` +
    `  1. Replace the placeholders — the table in the package README lists every one\n` +
    `  2. Delete any doc whose stack choice this project does not adopt, and its index entry\n` +
    `  3. Fill the units/ inventories; they ship as empty templates on purpose\n` +
    `  4. Answer the four decisions/ stubs\n` +
    `  5. Run 'pnpm check:docs' — it enumerates exactly what is still outstanding`,
);
