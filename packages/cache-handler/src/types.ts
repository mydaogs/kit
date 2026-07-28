/**
 * Structural shape of the KV client callers wire into the cache handler and
 * publisher.
 *
 * This package intentionally has NO runtime dependency on `@mydaogs/kv`. Reader
 * apps load the compiled handler outside Next's transpile pipeline, so any
 * bare workspace specifier here would be unresolvable from a serverless host's
 * flattened layout. Hosts own the KV singleton and pass it in.
 *
 * Methods are non-generic and return `unknown` so any Upstash-Redis-compatible
 * client (whose own signatures are generic) is assignable without variance
 * errors. Internal callers cast the awaited result to the shape they expect.
 */
export interface KvPipeline {
  zadd(key: string, args: { score: number; member: string }): unknown;
  set(key: string, value: string, options?: { ex?: number }): unknown;
  exec(): Promise<unknown[]>;
}

export interface KvClient {
  pipeline(): KvPipeline;
  zrange(
    key: string,
    min: number | string,
    max: number | string,
    options?: { byScore?: boolean; withScores?: boolean },
  ): Promise<unknown[]>;
  mget(...keys: string[]): Promise<unknown[]>;
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<unknown>;
}
