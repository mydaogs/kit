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
 * Collapses anything unexpected to a generic string. Only deliberate business
 * and auth errors keep their message — that is what makes the resulting
 * `errorMessage` safe to put on the wire.
 */
export const formatErrorMessage = (error: unknown): string =>
  error instanceof AppBusinessError || error instanceof APIError
    ? error.message
    : "A server error has occurred.";

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
