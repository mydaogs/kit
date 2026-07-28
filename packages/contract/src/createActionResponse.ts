import { AppBusinessError, formatErrorMessage } from "./errors";
import type {
  ActionResponseFail,
  ActionResponseSuccessWithData,
  ActionResponseSuccessWithoutData,
} from "./envelope";

interface SuccessProps<TData> {
  data: TData;
}
interface ErrorProps {
  error: unknown;
}

export interface ActionResponseOptions {
  /**
   * Fallback message for an error that is not a deliberate business/auth
   * failure. Overrides the process-wide default for this factory only.
   */
  genericMessage?: string;
}

/**
 * Binds `createActionResponse` to a specific generic message.
 *
 * This is the per-request seam: a server handling several locales in one
 * process builds one of these per request with the caller's localized string,
 * rather than mutating the module-level default that every concurrent request
 * shares.
 */
export function createActionResponseFactory(options: ActionResponseOptions) {
  function bound(): ActionResponseSuccessWithoutData;
  function bound<TData>(
    props: SuccessProps<TData>,
  ): ActionResponseSuccessWithData<TData>;
  function bound<TCode extends string = string>(
    props: ErrorProps,
  ): ActionResponseFail<TCode>;
  function bound<TData, TCode extends string = string>(
    props?: SuccessProps<TData> | ErrorProps,
  ):
    | ActionResponseSuccessWithoutData
    | ActionResponseSuccessWithData<TData>
    | ActionResponseFail<TCode> {
    return buildActionResponse<TData, TCode>(props, options.genericMessage);
  }
  return bound;
}

function buildActionResponse<TData, TCode extends string = string>(
  props?: SuccessProps<TData> | ErrorProps,
  genericMessage?: string,
):
  | ActionResponseSuccessWithoutData
  | ActionResponseSuccessWithData<TData>
  | ActionResponseFail<TCode> {
  if (!props) {
    return { success: true, data: null };
  }

  if ("error" in props) {
    const err = props.error;
    const fail: ActionResponseFail<TCode> = {
      success: false,
      errorMessage: formatErrorMessage(err, genericMessage),
    };
    if (err instanceof AppBusinessError) {
      if (err.code) fail.errorCode = err.code as TCode;
      if (err.params) fail.errorParams = err.params;
      fail.errorStatus = err.statusCode;
    }
    return fail;
  }

  return { success: true, data: props.data };
}

/**
 * Builds the discriminated-union result a server action returns.
 *
 * Overloaded so the return type stays exact at each call site: no argument is
 * a success with `data: null`, `{ data }` is a success carrying it, and
 * `{ error }` is the failure branch.
 */
export function createActionResponse(): ActionResponseSuccessWithoutData;
export function createActionResponse<TData>(
  props: SuccessProps<TData>,
): ActionResponseSuccessWithData<TData>;
export function createActionResponse<TCode extends string = string>(
  props: ErrorProps,
): ActionResponseFail<TCode>;
export function createActionResponse<TData, TCode extends string = string>(
  props?: SuccessProps<TData> | ErrorProps,
):
  | ActionResponseSuccessWithoutData
  | ActionResponseSuccessWithData<TData>
  | ActionResponseFail<TCode> {
  return buildActionResponse<TData, TCode>(props);
}
