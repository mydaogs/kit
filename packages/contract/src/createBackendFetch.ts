import { bigIntReviver, bigIntStringify } from "@kit/core";
import { AppBusinessError } from "./errors";
import type { ApiResponse } from "./envelope";
import { createPublicPathValidator, type PublicPathOf } from "./publicPaths";

export interface BackendFetchInit extends Omit<RequestInit, "body" | "headers"> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  headers?: HeadersInit;
  /** Receives the `cacheTags` the backend returned with a successful write. */
  onCacheTags?: (tags: string[]) => void;
  /** Local fallback when the backend does not supply its own tags. */
  cacheTags?: string[] | ((data: unknown) => string[]);
}

export interface CreateBackendFetchOptions<
  TPaths extends readonly string[],
  TCode extends string = string,
> {
  /** Origin of the backend service. Throws when unset rather than guessing. */
  getOrigin: () => string;
  /** Allowlisted GET-only, credential-free paths. */
  publicPaths: TPaths;
  /** Build-time contract probe from `createContractVerifier`. */
  verifyContract?: () => Promise<void>;
}

const isJsonSerializableBody = (
  body: unknown,
): body is Record<string, unknown> | unknown[] =>
  typeof body === "object" &&
  body !== null &&
  !(body instanceof FormData) &&
  !(body instanceof URLSearchParams) &&
  !(body instanceof Blob) &&
  !(body instanceof ArrayBuffer) &&
  !ArrayBuffer.isView(body);

const parseApiResponse = async <T, TCode extends string>(
  res: Response,
): Promise<ApiResponse<T, TCode> | null> => {
  try {
    const text = await res.text();
    if (!text) return null;

    const payload = JSON.parse(text, bigIntReviver) as unknown;
    if (!payload || typeof payload !== "object") return null;

    const candidate = payload as Record<string, unknown>;
    if (!("success" in candidate) || typeof candidate.success !== "boolean") {
      return null;
    }

    return payload as ApiResponse<T, TCode>;
  } catch {
    return null;
  }
};

const getRequestError = <T, TCode extends string>(params: {
  res: Response;
  response: ApiResponse<T, TCode> | null;
}): Error => {
  const { res, response } = params;

  if (res.status === 429) {
    const retryAfter =
      res.headers.get("Retry-After") ?? res.headers.get("X-Retry-After");
    const retrySuffix = retryAfter
      ? ` Retry after ${retryAfter} second(s).`
      : "";
    return new AppBusinessError(
      `Too many requests.${retrySuffix}`,
      429,
      "TOO_MANY_REQUESTS",
    );
  }

  // The backend sanitizes its own messages: only deliberate business/auth
  // errors carry a descriptive string. Throwing AppBusinessError (not a plain
  // Error) is what preserves `code`/`params` through the action layer.
  if (response && !response.success) {
    return new AppBusinessError(
      response.errorMessage,
      res.status,
      response.errorCode,
      response.errorParams,
    );
  }

  if (!res.ok) return new Error(`Request failed with status ${res.status}`);
  return new Error("Invalid API response format");
};

/**
 * Builds the credentialed and public fetch pair for a backend service.
 *
 * The public lane is enforced, not documented: it rejects bodies, non-GET
 * methods, credential overrides, and custom headers, so it can never drift
 * into sending cookies or triggering a CORS preflight.
 */
export function createBackendFetch<
  const TPaths extends readonly string[],
  TCode extends string = string,
>(options: CreateBackendFetchOptions<TPaths, TCode>) {
  const validatePublicPath = createPublicPathValidator(options.publicPaths);

  const buildUrl = (pathname: string): string => {
    const origin = options.getOrigin();
    if (!origin) throw new Error("Backend origin is not configured");
    if (/^https?:\/\//.test(pathname)) return pathname;
    return new URL(pathname, origin).toString();
  };

  const request = async <T>(params: {
    pathname: string;
    init: BackendFetchInit;
    credentials: RequestCredentials;
  }): Promise<T> => {
    const { pathname, init, credentials } = params;
    if (options.verifyContract) await options.verifyContract();

    const url = buildUrl(pathname);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    let body = init.body;
    if (isJsonSerializableBody(body)) {
      headers.set("Content-Type", "application/json");
      body = bigIntStringify(body);
    }

    const res = await fetch(url, {
      ...init,
      body: body as BodyInit | null | undefined,
      credentials,
      headers,
    });

    const response = await parseApiResponse<T, TCode>(res);
    if (!response || !res.ok || !response.success) {
      throw getRequestError({ res, response });
    }

    if (response.cacheTags?.length) {
      init.onCacheTags?.(response.cacheTags);
    } else if (init.cacheTags) {
      const tags =
        typeof init.cacheTags === "function"
          ? init.cacheTags(response.data)
          : init.cacheTags;
      if (tags?.length) init.onCacheTags?.(tags);
    }

    return response.data;
  };

  const backendFetch = async <T>(
    pathname: string,
    init: BackendFetchInit = {},
  ): Promise<T> => request<T>({ pathname, init, credentials: "include" });

  const publicBackendFetch = async <T>(
    pathname: PublicPathOf<TPaths>,
    init: { signal?: AbortSignal } = {},
  ): Promise<T> => {
    const unsafeInit = init as RequestInit;
    if (unsafeInit.body != null) {
      throw new Error("publicBackendFetch does not allow request bodies");
    }
    if (unsafeInit.method && unsafeInit.method.toUpperCase() !== "GET") {
      throw new Error("publicBackendFetch only allows GET requests");
    }
    if (unsafeInit.credentials !== undefined) {
      throw new Error("publicBackendFetch does not allow credential overrides");
    }
    if (unsafeInit.headers !== undefined) {
      throw new Error("publicBackendFetch does not allow custom headers");
    }
    validatePublicPath(pathname);

    return request<T>({
      pathname,
      init: { signal: init.signal, method: "GET" },
      credentials: "omit",
    });
  };

  return { backendFetch, publicBackendFetch };
}
