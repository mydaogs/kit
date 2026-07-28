import { Redis } from "@upstash/redis";

/**
 * The scheme of a URL-ish value, or `<none>` when it has no scheme delimiter.
 *
 * `value.split(":")[0]` is NOT sufficient: for a value with no colon at all —
 * `private.redis.internal` — it returns the whole string, so the "scheme only"
 * promise leaks a private hostname into whatever the process logs. The values
 * that reach this branch are precisely the malformed ones, so it has to be
 * exact rather than approximately right.
 */
const schemeOf = (value: string): string => {
  const index = value.indexOf(":");
  return index > 0 ? value.slice(0, index) : "<none>";
};


/**
 * Lazy singleton behind a Proxy so `process.env` is read at first *request*,
 * not at module load.
 *
 * Module load happens during a serverless host's build-time tracing pass,
 * where runtime env vars do not exist yet. Constructing eagerly there throws
 * and fails the build for a client nothing has used.
 *
 * This entrypoint deliberately has no `server-only` import: Next loads cache
 * handlers outside the normal app module graph, and `server-only` would reject
 * that context. Application code should import the default entrypoint instead.
 */
let _kv: Redis | undefined;
const boundCache = new Map<string, unknown>();

function assertRedisEnv(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (typeof url !== "string" || url.trim() === "") {
    throw new Error("@mydaogs/kv: UPSTASH_REDIS_REST_URL is missing or empty");
  }
  if (!url.startsWith("https://")) {
    // Scheme only, never the value: a misconfigured URL can carry userinfo
    // (`redis://user:password@host`) or a private hostname, and this throws
    // into whatever the process logs.
    throw new Error(
      `@mydaogs/kv: UPSTASH_REDIS_REST_URL must start with "https://" (got scheme: "${schemeOf(url)}")`,
    );
  }
  if (typeof token !== "string" || token.trim() === "") {
    throw new Error("@mydaogs/kv: UPSTASH_REDIS_REST_TOKEN is missing or empty");
  }

  return { url, token };
}

export const kv = new Proxy<Redis>({} as Redis, {
  get(_, prop: string | symbol) {
    if (!_kv) {
      const { url, token } = assertRedisEnv();
      _kv = new Redis({ url, token });
    }

    const key = String(prop);
    if (boundCache.has(key)) return boundCache.get(key);

    const value = (_kv as unknown as Record<string, unknown>)[key];
    const bound = typeof value === "function" ? value.bind(_kv) : value;
    boundCache.set(key, bound);
    return bound;
  },
});
