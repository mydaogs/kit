type Fetcher = <T>(pathname: string, init: { signal?: AbortSignal }) => Promise<T>;

export interface InfiniteQueryFnContext {
  pageParam?: string | null;
}

/**
 * Query-function factories bound to a transport.
 *
 * Pass the credentialed and public fetchers from `@kit/contract`'s
 * `createBackendFetch`; the public variants then inherit its path allowlist,
 * so a public hook cannot silently start sending cookies.
 */
export function createQueryFns(params: {
  fetch: Fetcher;
  publicFetch: Fetcher;
}) {
  const { fetch: credentialed, publicFetch } = params;

  /** Single-payload read. Use with `useQuery`. */
  const createQueryFn =
    <T>(requestUrl: string) =>
    ({ signal }: { signal: AbortSignal }) =>
      credentialed<T>(requestUrl, { signal });

  const createPublicQueryFn =
    <T>(requestUrl: string) =>
    ({ signal }: { signal: AbortSignal }) =>
      publicFetch<T>(requestUrl, { signal });

  /**
   * Cursor-paginated read. Use with `useInfiniteQuery`.
   * The caller owns param construction so cursor naming stays explicit.
   */
  const createInfiniteQueryFn =
    <T>(options: {
      pathname: string;
      buildSearchParams: (ctx: InfiniteQueryFnContext) => URLSearchParams;
    }) =>
    ({ pageParam, signal }: InfiniteQueryFnContext & { signal: AbortSignal }) => {
      const search = options.buildSearchParams({ pageParam });
      return credentialed<T>(`${options.pathname}?${search.toString()}`, {
        signal,
      });
    };

  const createPublicInfiniteQueryFn =
    <T>(options: {
      pathname: string;
      buildSearchParams: (ctx: InfiniteQueryFnContext) => URLSearchParams;
    }) =>
    ({ pageParam, signal }: InfiniteQueryFnContext & { signal: AbortSignal }) => {
      const search = options.buildSearchParams({ pageParam });
      return publicFetch<T>(`${options.pathname}?${search.toString()}`, {
        signal,
      });
    };

  return {
    createQueryFn,
    createPublicQueryFn,
    createInfiniteQueryFn,
    createPublicInfiniteQueryFn,
  };
}

/** Standard cursor-page envelope. Pair with `getNextPageParam`. */
export interface CursorPage<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

export const getNextCursorPageParam = <TItem>(
  lastPage: CursorPage<TItem>,
): string | undefined => lastPage.nextCursor ?? undefined;
