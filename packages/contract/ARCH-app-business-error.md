# [ARCH] - App Business Error

## Description

`AppBusinessError` is a custom error for expected business failures with an HTTP status code. Shared formatters normalize error messages and status codes across API routes, server actions, and UI toasts

## Behavior

- `AppBusinessError` carries `statusCode`, and optionally `code` (`BackendErrorCode`) and `params` (`Record<string, string | number>`)
- `formatErrorMessage` prioritizes `AppBusinessError` and `APIError`, then falls back to `error.message` or a generic message
- `formatErrorStatusCode` maps `APIError` values and returns `statusCode` for `AppBusinessError`, defaults to 500
- `actionErrorToThrowable(result)` converts a failure response back into an `AppBusinessError` with `code` and `params` preserved — use this instead of `new Error(result.errorMessage)` at throw sites in client hooks and components

## Error code resolution

A `backendErrorMessages.ts` map covers **every** `BackendErrorCode` with a translation key. The map is exhaustive (`satisfies Record<BackendErrorCode, string>`), so adding a catalog code without a key fails `check-types` — that is the guarantee that raw English never reaches the UI for a coded error. User-facing codes map to bespoke strings; internal/indexer/onchain-parse codes map to one generic server-error string

Resolvers (all scoped to the errors namespace):

- `resolveBackendErrorMessage(t, code, params?)` — total over codes: a known code resolves to its translation, an unrecognized but present code (a newer backend mid rolling-deploy) resolves to the generic server error, and only an **absent** code returns `undefined` so the caller can supply its own fallback
- `resolveActionErrorMessage(t, result)` — localizes a failure-shaped result; always returns a string. Prefer this over hand-writing `resolveBackendErrorMessage(...) ?? result.errorMessage`
- `resolveThrownErrorMessage(t, error, fallback)` — localizes a caught error; reads `code`/`params` off an `AppBusinessError` (preserved by `actionErrorToThrowable`) so throw→catch paths localize the same as inline-result paths

The backend `errorMessage` is diagnostic metadata and a last-resort fallback, not UI content

At every display boundary, action-result branches must use `resolveActionErrorMessage`; mutation `onError`, caught action errors, and query `error` display sites must use `resolveThrownErrorMessage(tErrors, error, localizedFallback)` so a coded backend error localizes instead of rendering raw English. Transport-only hooks may preserve and rethrow `AppBusinessError`, but UI code must not render its diagnostic `message` directly. Client-thrown form invariants are matched by `instanceof`, not by English message text

## Related files

- `<monorepo>/apps/app/src/lib/utils/errorUtils.ts`
- `<monorepo>/apps/app/src/lib/errors/backendErrorMessages.ts`
- `<monorepo>/packages/backend-contract/src/errors.ts`
