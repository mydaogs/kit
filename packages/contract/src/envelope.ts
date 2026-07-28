export type ApiResponse<TData = unknown, TCode extends string = string> =
  | { success: true; data: TData; cacheTags?: string[] }
  | {
      success: false;
      errorMessage: string;
      errorCode?: TCode;
      errorParams?: Record<string, string | number>;
    };

export type ActionResponseSuccessWithData<TData> = {
  success: true;
  data: TData;
};

export type ActionResponseSuccessWithoutData = {
  success: true;
  data: null;
};

export type ActionResponseFail<TCode extends string = string> = {
  success: false;
  errorMessage: string;
  errorCode?: TCode;
  errorParams?: Record<string, string | number>;
  errorStatus?: number;
};

export type ActionResponse<TData = null, TCode extends string = string> =
  | (TData extends null
      ? ActionResponseSuccessWithoutData
      : ActionResponseSuccessWithData<TData>)
  | ActionResponseFail<TCode>;
