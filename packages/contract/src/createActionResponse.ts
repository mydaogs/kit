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
  if (!props) {
    return { success: true, data: null };
  }

  if ("error" in props) {
    const err = props.error;
    const fail: ActionResponseFail<TCode> = {
      success: false,
      errorMessage: formatErrorMessage(err),
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
