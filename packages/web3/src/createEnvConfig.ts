import type { z } from "zod";

/**
 * Wraps a Zod schema into a validated env accessor with a readable aggregate
 * error.
 *
 * The caller must pass a **literal** object of `process.env.NEXT_PUBLIC_X`
 * member accesses for client config. Next inlines those values only on static
 * member access — building the object dynamically (spread, loop, computed key)
 * yields `undefined` in the browser bundle with no build-time warning.
 */
export function createEnvConfig<TSchema extends z.ZodType>(params: {
  schema: TSchema;
  source: unknown;
  label?: string;
}): () => z.infer<TSchema> {
  const label = params.label ?? "Env vars";
  let cached: z.infer<TSchema> | undefined;

  return function getEnvConfig(): z.infer<TSchema> {
    if (cached !== undefined) return cached;

    const result = params.schema.safeParse(params.source);
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join(".").toUpperCase()} - ${issue.message}`)
        .join("; ");
      throw new Error(`${label} validation failed: ${detail}`);
    }

    cached = result.data;
    return cached;
  };
}
