# [ARCH] - Loading State Primitives

## Feature description

Standardizes loading UI by routing app pending states through a small set of shared primitives instead of ad-hoc loaders

- `StatusCardLoading` is used for non-button loading states
- `LoadingButton` is used for pending button states
- `LoadingButton` supports loading icon and container class overrides so oversized button layouts can keep spinner alignment consistent without bespoke loading code
- `Web3ConnectBtn` receives `isLoading` for Web3 action pending states
- New or edited loading UI is expected to use these primitives for generic app-data and action pending states
- `Skeleton` remains acceptable for media placeholders such as images, and a raw spinner icon remains acceptable for tiny embedded indicators such as inline counters and form input status icons
- Direct spinner usage, ad-hoc `"..."` placeholders, and custom generic skeleton loaders are not part of the preferred app-level pattern outside those exceptions

This improves consistency, keeps loading visuals uniform, and centralizes future style/UX changes in shared UI units

## Related files

- `StatusCardLoading` (`@mydaogs/ui/client`)
- `LoadingButton` (`@mydaogs/ui/client`)
- `rules/loading-state-rules.md`
