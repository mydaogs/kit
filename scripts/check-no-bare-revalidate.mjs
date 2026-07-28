#!/usr/bin/env node
/**
 * Backend-only writers (cron, webhooks, indexer, auth hooks) must not call a
 * bare `revalidateTag`. That only invalidates the calling process; peer
 * deployments keep serving stale data until their own TTL expires.
 *
 * Those call sites must go through the cross-app publisher instead. A
 * deliberate exception is allowed with a comment on the call line or the line
 * immediately above it:
 *
 *   await invalidateAppTags([...]); // allow:invalidateAppTags — reason
 *
 * Deliberately flags EVERY bare `revalidateTag` in a backend-writer path,
 * rather than only those naming a tag registry on the same line. Requiring
 * both tokens on one line misses the two most common real forms:
 *
 *   const tag = APP_TAGS.userInbox(userId);
 *   revalidateTag(tag);                     // variable indirection
 *
 *   revalidateTag(
 *     APP_TAGS.orgFeed(userId),             // multi-line call
 *   );
 *
 * Usage: node scripts/check-no-bare-revalidate.mjs [srcDir]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const srcDir = resolve(process.argv[2] ?? "src");
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx"]);
const ALLOW_COMMENT = /\/\/\s*allow:/;
const REVALIDATE_CALL = /\brevalidateTag\s*\(/;

/** Directories whose writers cannot reach browser deployments any other way. */
const BACKEND_WRITER_PATHS = ["/cron/", "/webhooks/", "/indexer/", "/lib/auth/"];

if (!existsSync(srcDir)) {
  console.error(
    `Cache invalidation check failed: source directory not found at ${srcDir}\n` +
      `Pass the correct path: node check-no-bare-revalidate.mjs <srcDir>`,
  );
  process.exit(1);
}

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (SCANNED_EXTENSIONS.has(extname(full))) files.push(full);
  }
  return files;
}

const failures = [];
let scannedFiles = 0;

for (const file of walk(srcDir)) {
  const normalized = file.split("\\").join("/");
  const isBackendWriter = BACKEND_WRITER_PATHS.some((path) =>
    normalized.includes(path),
  );
  if (!isBackendWriter) continue;
  scannedFiles += 1;

  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, index) => {
    if (!REVALIDATE_CALL.test(line)) return;
    // Accept the escape hatch on the call line or the line directly above, so
    // a multi-line call can carry its justification on the opening line.
    if (ALLOW_COMMENT.test(line)) return;
    if (index > 0 && ALLOW_COMMENT.test(lines[index - 1] ?? "")) return;

    failures.push(
      `${relative(process.cwd(), file)}:${index + 1} — bare revalidateTag in a backend-only writer; use the cross-app publisher, or add an "// allow:" comment with a reason`,
    );
  });
}

if (failures.length > 0) {
  console.error("Cache invalidation check failed:\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Cache invalidation check passed (${scannedFiles} backend-writer file(s) scanned)`,
);
