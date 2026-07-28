/**
 * Error class hierarchy and formatters shared by API routes, server actions,
 * and UI display boundaries.
 *
 * The catalog itself (`BackendErrorCode`) is project-owned: declare it in the
 * consuming app and pass it as the generic parameter. What is portable is the
 * *shape* — a stable code plus interpolation params — and the rule that a
 * descriptive message only ever accompanies a deliberate business error.
 */

export class APIError extends Error {
  status: string;

  constructor(status: string, options: { message: string }) {
    super(options.message);
    this.status = status;
    this.name = "APIError";
  }
}

export class AppBusinessError<TCode extends string = string> extends Error {
  statusCode: number;
  code?: TCode;
  params?: Record<string, string | number>;

  constructor(
    message: string,
    statusCode: number,
    code?: TCode,
    params?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "AppBusinessError";
    this.statusCode = statusCode;
    this.code = code;
    this.params = params;
  }
}

/**
 * Fallback used when an error is not a deliberate business/auth failure.
 *
 * English by default because this package has no i18n dependency. Override it
 * once at startup if the string can reach the UI — it travels to the client
 * through the action envelope.
 */
let genericErrorMessage = "A server error has occurred.";

export const setGenericErrorMessage = (message: string): void => {
  genericErrorMessage = message;
};

/**
 * Collapses anything unexpected to the generic string. Only deliberate
 * business and auth errors keep their message — that is what makes the
 * resulting `errorMessage` safe to put on the wire.
 *
 * Pass `genericMessage` to override the process-wide default for one call.
 * A server handling several locales in one process must use this (or
 * `createActionResponseFactory`) rather than the global setter, which has no
 * per-request seam.
 */
export const formatErrorMessage = (
  error: unknown,
  genericMessage?: string,
): string =>
  error instanceof AppBusinessError || error instanceof APIError
    ? error.message
    : (genericMessage ?? genericErrorMessage);

export const formatErrorStatusCode = (error: unknown): number => {
  if (error instanceof APIError) {
    if (error.status === "UNAUTHORIZED") return 401;
    if (error.status === "FORBIDDEN") return 403;
    return 400;
  }
  if (error instanceof AppBusinessError) return error.statusCode;
  return 500;
};

/**
 * Converts a failed action result back into a throwable that preserves `code`
 * and `params`. Use this instead of `new Error(result.errorMessage)` at throw
 * sites, so throw→catch paths localize identically to inline-result paths.
 */
export const actionErrorToThrowable = <TCode extends string = string>(result: {
  errorMessage: string;
  errorCode?: TCode;
  errorParams?: Record<string, string | number>;
  errorStatus?: number;
}): AppBusinessError<TCode> =>
  new AppBusinessError<TCode>(
    result.errorMessage,
    result.errorStatus ?? 500,
    result.errorCode,
    result.errorParams,
  );
