# ARCH - Url Toasts

The app supports URL-triggered toast notifications, so redirects and deep links can show a one-time message after navigation (for example sign-in success, email updated)

## Overview

- A toast is requested by adding `?toast=<TOKEN>` to the destination URL after the app has confirmed the relevant success condition
- On the client, the app **consumes** that param (shows a toast) and then **removes it from the URL** to avoid repeated toasts on refresh
- Toast text is translated via `next-intl` using a dedicated namespace

## How it works

A globally mounted effects component calls `useToastParam()` on every page and renders the toaster UI

`useToastParam` implements the convention:

- Param key: `toast`
- On consume: shows the translated message when the token exists
- Unknown toast tokens are treated as invalid public URL input: the URL param is still consumed and cleaned, but no toast is shown

Consumption is implemented via a generic helper `useUrlParamAction`:

- Reads the param from `useSearchParams()`
- Removes the param from the live URL with `window.history.replaceState()` in a layout effect
- Executes the callback once while the value is continuously present; resets after the parameter disappears, so a later reappearance of the same value triggers again

URL writers that merge query params must build mutable params from `window.location.search` at write time. This prevents a stale `useSearchParams()` snapshot from reintroducing already-consumed one-time params when another effect writes the URL later in the same mount

Because cleanup uses `window.history.replaceState()` instead of a router navigation, `useSearchParams()` consumers in the same render may still see the consumed token until a later navigation. The param is therefore write-only for producers and owned exclusively by its single consumer hook

## Auth error variant

A parallel one-time URL param mechanism exists for auth errors:

- Param key: `authError`
- Owner: `useAuthErrorParam()`, also mounted globally — the sole consumer of this param
- On consume: normalizes the raw string value (unknown codes fall back to a generic sign-in failure), then fires an error toast from the errors namespace. Unlike `toast`, unknown values always produce a toast, because normalization never silently discards
- Signed-in users who hit a stale or invalid magic link are redirected to their role home with `?authError=<code>` so the toast surfaces there rather than being silently dropped

Inline form error blocks are reserved for form-submission and network failures only — not for URL-carried errors

## Producer rule

Third-party auth callbacks must not point straight at a success toast. They should return to app-owned routes first so the app can verify the session, map any error into a public code, and only then emit a toast or redirect to sign-in

## Related docs

- `ARCH-url-query-state.md` (shared query-string helpers and conventions)
- `ARCH-toast-lifecycle.md` (shared toast lifecycle options)
