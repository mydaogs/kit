/**
 * The credential-free read lane.
 *
 * A path belongs here only when its payload is identical for every viewer. If
 * the response varies by who is asking, it belongs behind a session. The
 * allowlist is a literal tuple so the legal query-string forms derive from it,
 * and `createBackendFetch` validates membership at runtime.
 */
export type PublicPathOf<TPaths extends readonly string[]> =
  | TPaths[number]
  | `${TPaths[number]}?${string}`;

export const createPublicPathValidator = <const TPaths extends readonly string[]>(
  paths: TPaths,
) => {
  const basePaths = new Set<string>(paths);

  /**
   * Validates against the URL that will actually be fetched.
   *
   * Parsing against a throwaway base is unsound: `//evil.example/public-data/x`
   * resolves to pathname `/public-data/x` under a dummy base — passing the
   * allowlist — while resolving to `https://evil.example/public-data/x` under
   * the real origin. The request then returns attacker-controlled JSON that the
   * caller treats as a trusted `ApiResponse`. Same `origin` comparison as the
   * credentialed lane, for the same reason.
   */
  return (pathname: string, origin: string): void => {
    const base = new URL(origin);
    const target = new URL(pathname, base);

    if (target.origin !== base.origin) {
      throw new Error(
        `Refusing a public backend request to ${target.origin}; configured backend origin is ${base.origin}`,
      );
    }
    if (!basePaths.has(target.pathname)) {
      throw new Error(`Unsupported public backend path: ${target.pathname}`);
    }
  };
};
