# Business errors

## Description

`AppBusinessError` is the error type for *expected* failures — a rejected
business rule, not a bug. It carries an HTTP status code and, optionally, a
machine-readable code and its interpolation params, so the same failure survives
both the inline-result path and the throw/catch path without losing meaning

## Exports

- `AppBusinessError` — carries `statusCode`, optional `code`, optional `params`
- `APIError` — the transport-level counterpart
- `formatErrorMessage` — prioritizes `AppBusinessError` and `APIError`, then
  falls back to `error.message`, then to a generic message
- `formatErrorStatusCode` — maps `APIError` values, returns `statusCode` for
  `AppBusinessError`, defaults to 500
- `actionErrorToThrowable(result)` — turns a failure envelope back into an
  `AppBusinessError` with `code` and `params` intact
- `setGenericErrorMessage` — sets the fallback string for failures that carry
  nothing more specific

## Why actionErrorToThrowable exists

A client that receives a failure envelope and needs to throw must not write
`new Error(result.errorMessage)`. That discards `code` and `params` and leaves
the catch site with an unlocalizable English string it can only match on

`actionErrorToThrowable` preserves them, so a `catch` block localizes from the
same `code` an inline branch would have used. Throw-path and result-path
rendering stay identical

## The message is not the contract

`formatErrorMessage` produces diagnostic text. It is not UI copy — it is
unlocalized, and its wording is free to change. Client code branches on `code`

Matching on message text is the failure mode this exists to prevent: it breaks
on any rewording, and it cannot be type-checked. Client-thrown invariants should
be matched with `instanceof`, not by comparing strings

## What lives in the consuming app

The project owns its error-code union, the map from code to translation key, and
the resolvers that turn a code into localized copy. Making that map exhaustive
over the code union — so adding a code without a translation is a type error —
is the mechanism that keeps raw English out of the UI, and it belongs where the
codes and the translations are
