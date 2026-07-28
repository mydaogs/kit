/**
 * Named cache tiers instead of inline millisecond literals.
 *
 * The names are the point: a reviewer can tell whether a read was classified
 * correctly, which is impossible when every hook carries a bare
 * `staleTime: 120000`.
 */
export const CACHE_TIMES = {
  /** No caching — always fresh. For chain reads and receipt polling. */
  NO_CACHE: { staleTime: 0, gcTime: 0 },

  /** 30 seconds — frequently changing data. */
  VERY_SHORT_CACHE: { staleTime: 30 * 1000, gcTime: 1 * 60 * 1000 },

  /** 1 minute — dynamic user content. */
  SHORT_CACHE: { staleTime: 1 * 60 * 1000, gcTime: 5 * 60 * 1000 },

  /** 2 minutes — lists and feeds. */
  MEDIUM_CACHE: { staleTime: 2 * 60 * 1000, gcTime: 5 * 60 * 1000 },

  /** 5 minutes — session and auth data. */
  STABLE_CACHE: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 },

  /** 10 minutes — rarely changing organizational data. */
  LONG_CACHE: { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 },

  /**
   * 24 hours — static reference data (cities, countries).
   *
   * Deliberately finite rather than `Infinity`, so the server cache stays the
   * freshness boundary and a long-lived tab eventually re-reads.
   *
   * `gcTime` must be >= `staleTime`: a shorter one evicts the entry while it is
   * still considered fresh, so every remount refetches and the long staleTime
   * buys nothing.
   */
  DAY_CACHE: { staleTime: 24 * 60 * 60 * 1000, gcTime: 25 * 60 * 60 * 1000 },
} as const;

export type CacheTime = (typeof CACHE_TIMES)[keyof typeof CACHE_TIMES];
