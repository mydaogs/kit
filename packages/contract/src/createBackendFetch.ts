import { bigIntReviver, bigIntStringify } from "@mydaogs/core";
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

export interface BackendFetchMessages {
  /** Shown for a 429. Receives the parsed `Retry-After` seconds, if present. */
  tooManyRequests: (retryAfterSeconds: string | null) => string;
}

const DEFAULT_MESSAGES: BackendFetchMessages = {
  tooManyRequests: (retryAfterSeconds) =>
    retryAfterSeconds
      ? `Too many requests. Retry after ${retryAfterSeconds} second(s).`
      : "Too many requests.",
};

export interface CreateBackendFetchOptions<TPaths extends readonly string[]> {
  /** Origin of the backend service. Throws when unset rather than guessing. */
  getOrigin: () => string;
  /** Allowlisted GET-only, credential-free paths. */
  publicPaths: TPaths;
  /** Build-time contract probe from `createContractVerifier`. */
  verifyContract?: () => Promise<void>;
  /**
   * Copy for errors this layer raises itself. Supply localized strings — the
   * defaults are English and reach the UI through the action envelope.
   */
  messages?: BackendFetchMessages;
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

const parseApiResponse = async <T>(
  res: Response,
): Promise<ApiResponse<T> | null> => {
  try {
    const text = await res.text();
    if (!text) return null;

    const payload = JSON.parse(text, bigIntReviver) as unknown;
    if (!payload || typeof payload !== "object") return null;

    const candidate = payload as Record<string, unknown>;
    if (!("success" in candidate) || typeof candidate.success !== "boolean") {
      return null;
    }

    return payload as ApiResponse<T>;
  } catch {
    return null;
  }
};

const getRequestError = <T>(params: {
  res: Response;
  response: ApiResponse<T> | null;
  messages: BackendFetchMessages;
}): Error => {
  const { res, response, messages } = params;

  if (res.status === 429) {
    const retryAfter =
      res.headers.get("Retry-After") ?? res.headers.get("X-Retry-After");
    return new AppBusinessError(
      messages.tooManyRequests(retryAfter),
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
export function createBackendFetch<const TPaths extends readonly string[]>(
  options: CreateBackendFetchOptions<TPaths>,
) {
  const validatePublicPath = createPublicPathValidator(options.publicPaths);
  const messages = options.messages ?? DEFAULT_MESSAGES;

  /**
   * Every request is pinned to the configured origin.
   *
   * The credentialed fetcher sends `credentials: "include"`, so a request to
   * any other host forwards the session cookie there — the exact hazard the
   * public lane is hardened against.
   *
   * The check runs on the **resolved** URL rather than per input shape. Pinning
   * only inputs matching `^https?://` leaves several forms that resolve to a
   * foreign host without looking absolute:
   *
   * ```
   * new URL("//evil.example/x",   "https://api.example")  -> https://evil.example/x
   * new URL("\\\\evil.example/x", "https://api.example")  -> https://evil.example/x
   * new URL("\\/evil.example/x",  "https://api.example")  -> https://evil.example/x
   * ```
   *
   * WHATWG URL normalizes backslashes to forward slashes for special schemes,
   * so scheme-relative input in either slash direction swaps the host while
   * inheriting the scheme. Resolving first and comparing `origin` once covers
   * absolute, relative, and scheme-relative input with no shape enumeration.
   */
  const buildUrl = (pathname: string): string => {
    const origin = options.getOrigin();
    if (!origin) throw new Error("Backend origin is not configured");

    const base = new URL(origin);
    const target = new URL(pathname, base);

    if (target.origin !== base.origin) {
      throw new Error(
        `Refusing to send a credentialed request to ${target.origin}; configured backend origin is ${base.origin}`,
      );
    }

    return target.toString();
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

    const response = await parseApiResponse<T>(res);
    if (!response || !res.ok || !response.success) {
      throw getRequestError({ res, response, messages });
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
    validatePublicPath(pathname, options.getOrigin());

    return request<T>({
      pathname,
      init: { signal: init.signal, method: "GET" },
      credentials: "omit",
    });
  };

  return { backendFetch, publicBackendFetch };
}
