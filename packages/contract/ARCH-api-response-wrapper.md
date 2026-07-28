# Action and API response envelope

## Description

One envelope shape for every backend response and every server action result, so
a caller branches on `success` rather than learning each endpoint's own shape

## The shape

```ts
{ success: true,  data }
{ success: false, errorMessage, errorCode?, errorParams? }
```

`ApiResponse` types the HTTP side; `ActionResponse` and its
`ActionResponseSuccessWithData` / `ActionResponseSuccessWithoutData` /
`ActionResponseFail` members type the server-action side

## createActionResponse

Overloaded so the return type is exact at each call site rather than a union the
caller has to narrow:

```ts
createActionResponse(): ActionResponseSuccessWithoutData;
createActionResponse<TData>({ data: TData }): ActionResponseSuccessWithData<TData>;
createActionResponse({ error: unknown }): ActionResponseFail;
```

On the failure branch it extracts `code` and `params` from an
`AppBusinessError`, so callers check `result.errorCode` instead of
string-matching `result.errorMessage`. See
[`ARCH-app-business-error.md`](./ARCH-app-business-error.md)

`createActionResponseFactory` binds a project's own error-code union to that
signature, so `errorCode` is typed rather than a bare `string`

## errorCode is the contract; errorMessage is not

`errorMessage` is diagnostic metadata and a last-resort fallback. It is not UI
content and must not be rendered as-is — it is unlocalized and its wording is
not stable across versions. `errorCode` plus `errorParams` is what a client
branches on and localizes

`errorParams` carries interpolation values for parameterized codes, so a message
like a length limit can render its bound without the backend formatting prose

## bigint payloads

This package does not serialize. A response containing `bigint` must be produced
and consumed through the tagged wrapper in
[`@mydaogs/core`](https://www.npmjs.com/package/@mydaogs/core) —
`bigIntStringify` and `bigIntParse`. Native `JSON.stringify` throws on a bigint,
and native `JSON.parse` yields wrapper objects that later `BigInt(...)` calls
reject

## What lives in the consuming app

The HTTP-layer wrapper that turns this envelope into a framework `Response`,
public `Cache-Control` policy for audited GET routes, and the localization of
`errorCode` into user-facing strings. This package defines the shape and the
error semantics, not the transport or the copy
