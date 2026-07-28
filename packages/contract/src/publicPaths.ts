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

  return (pathname: string): void => {
    if (/^https?:\/\//.test(pathname)) {
      throw new Error("publicFetch only accepts backend pathnames");
    }
    const url = new URL(pathname, "https://public-backend-path.invalid");
    if (!basePaths.has(url.pathname)) {
      throw new Error(`Unsupported public backend path: ${url.pathname}`);
    }
  };
};
