# Loading State Rules

## Default

- Loading UI must use the shared loading primitives unless a documented exception applies
- Use `StatusCardLoading` for non-button loading states in app UI
- Use `variant="card"` for page-level or section-level blocking states
- Use `variant="compact"` for inline, table, modal, and small-area loading placeholders
- Use `LoadingButton` for any button that has an async pending/loading state
- Pass `isLoading` to `LoadingButton` or `Web3ConnectBtn` instead of rendering a spinner icon manually
- Do not add raw spinner icons, ad-hoc `"..."` placeholders, bespoke loading text, or custom loading-only components when `StatusCardLoading`, `LoadingButton`, or `Web3ConnectBtn` fit the state
- Do not introduce new skeleton loaders for generic page, section, modal, table, or button pending states

## Media exception

- Visual media placeholders may use `Skeleton` when the UI is loading an image or other media surface rather than app-data pending state
- Keep media skeletons scoped to the media container and do not reuse them for generic page, table, modal, or button loading states

## Inline exception

- A raw spinner icon is allowed for tiny embedded indicators such as inline counters and form input status icons when shared primitives are spatially awkward
- The indicator should stay narrow, adjacent to the text or field it annotates, and should not become a generic loading fallback

## When to use

- Any React UI state where data is pending and content is not ready
- Any action button that disables itself while an async action is in progress
- Suspense and route-transition fallbacks inside app pages and modal content

## When not to use

- Toast-specific loading visuals in the toast library internals
- Internal implementation details inside `StatusCardLoading` and `LoadingButton` components
- Visual media placeholders where the UI is loading an image surface rather than representing app-data pending state
- Tiny embedded raw spinner indicators used under the inline exception above
- Untouched existing code; new or edited loading UI should be normalized to shared primitives in the same patch

## Examples

- Page or card content loading
  - `<StatusCardLoading />`
  - `<StatusCardLoading variant="compact" className="w-full py-6" />`
- Button loading
  - `<LoadingButton isLoading={isPending}>Save</LoadingButton>`
  - `<Web3ConnectBtn isLoading={isProcessing}>Approve</Web3ConnectBtn>`
- Media placeholder
  - `<Skeleton className="absolute inset-0" />`
- Inline indicator
  - `<LoaderCircle className="inline size-4 animate-spin" aria-hidden="true" />`
- Avoid
  - `isLoading ? "..." : value`
  - `isLoading ? <LoaderCircle className="animate-spin" /> : null`
  - `const CustomSkeleton = () => <div className="..." />` for generic app-data loading states
