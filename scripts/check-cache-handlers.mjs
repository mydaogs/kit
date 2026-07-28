#!/usr/bin/env node
/**
 * Every app running `cacheComponents` must register the distributed cache
 * handler. Forgetting it is silent: the app works, but its cache is
 * process-local, so peer deployments never observe an invalidation and serve
 * stale data indefinitely.
 *
 * Usage: node scripts/check-cache-handlers.mjs [appsDir]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const appsDir = resolve(process.argv[2] ?? "apps");
const EXEMPT_APPS = new Set((process.env.CACHE_HANDLER_EXEMPT ?? "").split(",").filter(Boolean));

function listAppDirs() {
  try {
    return readdirSync(appsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function readConfig(appName) {
  for (const ext of ["ts", "mjs", "js"]) {
    try {
      return readFileSync(join(appsDir, appName, `next.config.${ext}`), "utf-8");
    } catch {
      /* try next extension */
    }
  }
  return null;
}

const failures = [];

for (const appName of listAppDirs()) {
  if (EXEMPT_APPS.has(appName)) continue;

  const config = readConfig(appName);
  if (!config) continue;

  const usesCacheComponents = /cacheComponents\s*:\s*true/.test(config);
  if (!usesCacheComponents) continue;

  const registersHandler = /cacheHandlers?\s*:/.test(config);
  if (!registersHandler) {
    failures.push(
      `${appName}: cacheComponents is enabled but no cacheHandlers entry is registered in next.config`,
    );
    continue;
  }

  const tracesHandler = /outputFileTracingIncludes/.test(config);
  if (!tracesHandler) {
    failures.push(
      `${appName}: registers a cache handler but has no outputFileTracingIncludes — Next cannot discover the handler path from route imports, so the production bundle will omit it`,
    );
  }
}

if (failures.length > 0) {
  console.error("Cache handler check failed:\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Cache handler check passed");
