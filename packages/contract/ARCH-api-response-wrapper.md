# [ARCH] - API Response Wrapper

## Description

Standardized helpers for backend API routes and server actions to return consistent success and error shapes, with status code mapping and shared error formatting

## Behavior

- `createApiResponse` returns a `NextResponse` for backend API routes
- `createActionResponse` returns a plain object for server actions
- Response shape is `{ success: true, data }` or `{ success: false, errorMessage, errorCode?, errorParams? }`
- `errorCode` is a `BackendErrorCode` from `@shared/backend-contract`; `errorParams` carries interpolation values for parameterized messages (e.g. `{ max: 500 }` for a length-limit code)
- Uses `formatErrorMessage` and `formatErrorStatusCode` for errors, supports `APIError` and `AppBusinessError`
- `createActionResponse` extracts `code` and `params` from `AppBusinessError` when building the failure shape, so client code can check `result.errorCode` instead of string-matching `result.errorMessage`
- API responses serialize `bigint` values through the tagged `bigIntJson` wrapper so route payloads can safely cross JSON boundaries without flattening types to strings
- `createApiResponse` accepts optional response headers, normalizes any `HeadersInit` shape, and always locks the JSON content type after caller headers are merged
- `publicCacheControl` is an allow-list helper for audited public GET routes; it emits `public, max-age=0, s-maxage=<revalidate>, stale-while-revalidate=<expire - revalidate>`
- Public `Cache-Control` applies to downstream shared caches and is outside the Next data-cache invalidation graph: `revalidateTag()` and `updateTag()` do not purge CDN-cached API responses, so each `s-maxage` must match acceptable edge staleness rather than the server `cacheLife` profile

## Overload shape

Function overloads keep the return type exact at each call site:

```ts
export function createActionResponse(): ActionResponseSuccessWithoutData;
export function createActionResponse<TData>(
  props: { data: TData },
): ActionResponseSuccessWithData<TData>;
export function createActionResponse(
  props: { error: unknown },
): ActionResponseFail;
```

## Related files

- `<monorepo>/apps/backend/src/lib/utils/createApiResponse.ts`
- `<monorepo>/apps/app/src/lib/utils/createActionResponse.ts`
- `<monorepo>/apps/app/src/lib/utils/bigIntJson.ts`
- `<monorepo>/apps/*/src/lib/utils/errorUtils.ts`

## Usage

- API routes under `<monorepo>/apps/backend/src/app`
- Server actions under `<monorepo>/apps/app/src/actions`
