import "server-only";

import { kv } from "./rest";

/**
 * Application-facing entrypoint. Fails fast at import time so a misconfigured
 * deployment surfaces immediately rather than on the first cache miss.
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
