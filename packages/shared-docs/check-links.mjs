#!/usr/bin/env node
/**
 * Every relative markdown link must resolve.
 *
 * Docs were split across packages, so a link that used to be a sibling may now
 * live in another package. A broken cross-reference is silent otherwise — the
 * doc still renders, it just sends the reader nowhere.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const LINK = /\]\((\.{0,2}\/?[A-Za-z0-9_./-]+\.md)(#[^)]*)?\)/g;

/**
 * A template's links are written to resolve where it is copied to — the
 * consumer's `docs/` — not where it ships from. Checking them here would demand
 * this package carry a `product/` and a `runbooks/` it deliberately does not
 * ship. `check-docs-adoption.mjs` is what verifies them, in the repo that
 * adopted the template.
 */
const TEMPLATES = new Set(["docs-readme-template.md"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".md") && !TEMPLATES.has(relative(root, full))) out.push(full);
  }
  return out;
}

const failures = [];
let checked = 0;

for (const file of walk(root)) {
  const body = readFileSync(file, "utf-8");
  for (const match of body.matchAll(LINK)) {
    checked += 1;
    const target = resolve(dirname(file), match[1]);
    if (!existsSync(target)) {
      failures.push(`${relative(root, file)} -> ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Broken markdown links (${failures.length}):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`Markdown link check passed (${checked} link(s) across this package)`);
