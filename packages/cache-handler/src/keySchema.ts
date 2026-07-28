function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasRedisEnv(): boolean {
  return (
    isNonEmptyString(process.env.UPSTASH_REDIS_REST_URL) &&
    isNonEmptyString(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

/**
 * The namespace is mandatory whenever Redis is in play: deployments that share
 * a namespace share invalidation, and deployments that must not must differ.
 * Defaulting it silently is how preview traffic ends up purging production.
 */
export function getCacheNamespace(redisEnabled: boolean): string {
  const namespace = process.env.NEXT_CACHE_NAMESPACE?.trim();
  if (namespace) return namespace;

  if (redisEnabled) {
    throw new Error(
      "NEXT_CACHE_NAMESPACE is required when the distributed cache handler uses Redis.",
    );
  }

  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export const CACHE_KEY_PREFIX = "next-cache";
export const TAG_TTL_SOFT_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const TAG_TTL_HARD_SECONDS = 365 * 24 * 60 * 60; // 365 days

export function getTagKey(
  prefix: string,
  env: string,
  appName: string,
  tag: string,
): string {
  return `${prefix}:${env}:${appName}:tag:${tag}`;
}

export function getBumpKey(
  prefix: string,
  env: string,
  appName: string,
): string {
  return `${prefix}:${env}:${appName}:tag-bumps`;
}
