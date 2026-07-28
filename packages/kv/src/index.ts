import "server-only";

import { kv } from "./rest";

/**
 * Application-facing entrypoint.
 *
 * Deliberately the opposite posture from `./rest`: this validates eagerly at
 * module load, so a misconfigured deployment fails at startup rather than on
 * the first cache miss in a request.
 *
 * That is only safe for ordinary application code, which is imported inside a
 * request-serving graph where runtime env exists. Anything loaded during a
 * build-time tracing pass — the Next cache handler in particular — must import
 * `./rest` instead, whose Proxy defers construction to first use. Importing
 * this module from there fails the build.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (typeof url !== "string" || url.length === 0) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL is missing or empty. Set it in your environment.",
  );
}

if (typeof token !== "string" || token.length === 0) {
  throw new Error(
    "UPSTASH_REDIS_REST_TOKEN is missing or empty. Set it in your environment.",
  );
}

if (!url.startsWith("https://")) {
  throw new Error(
    `UPSTASH_REDIS_REST_URL must start with https://. Received: ${url}`,
  );
}

export { kv };
