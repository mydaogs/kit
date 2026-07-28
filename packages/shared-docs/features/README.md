# Features Guideline

- This folder contains docs for general summarized architectural features
- Each feature summary has its own markdown file with a kebab-case name
- All architecture (ARCH) features must be listed below for easy navigation. Keep this list updated

## Template for documenting a feature

- Feature name `[ARCH] - <Feature Name>`
- Feature description - summary of what it does and achieves, summary of main implementation details
- Related files list

## Scope of this folder in the shared kit

Only `ARCH-*` docs are carried between projects. `STORY-*` docs describe user stories and are by definition project-specific — write them fresh in each repo, alongside these

## Features list (file name + one sentence short description)

### Web3 (7)

1. `ARCH-wagmi-integration.md` - Wallet connectivity with wagmi + Reown AppKit, SSR-safe and env-driven
2. `ARCH-network-config.md` - Centralized chain selection driven by env config
3. `ARCH-env-config-split.md` - Client/server environment variable separation with Zod validation
4. `ARCH-contract-write-wrapper.md` - `useAppWriteContract` wrapping wagmi with toast lifecycle, reconciliation, and query invalidation
5. `ARCH-durable-pending-tx-sync.md` - Durable pending transaction registry with reconciliation, toast recovery, and cross-tab action blocking
6. `ARCH-pending-transactions.md` - Persisting blockchain transaction tracking across refreshes
7. `ARCH-web3-buttons.md` - Forcing wallet connection and registered-address checks before onchain operations

### Indexing (1)

8. `ARCH-event-processing-pipeline.md` - Event processor with atomic deduplication, retries, ordering guards, and a terminal-failure taxonomy

### Data Fetching & Caching (5)

9. `ARCH-react-cache-pattern.md` - Server-side caching layers: React `cache()` and `"use cache"` with tags
10. `ARCH-data-layer-modules.md` - Organized server-only data modules under `src/data` with domain folders
11. `ARCH-tanstack-query-integration.md` - Client-side query management with TanStack Query and gated persistence
12. `ARCH-query-invalidation-pattern.md` - Automatic query invalidation on blockchain transactions
13. `ARCH-query-error-boundary.md` - TanStack Query error boundary with reset and auth redirect

### API & Server Actions (6)

14. `ARCH-backend-api-contract.md` - Versioned backend route contract and transport rules
15. `ARCH-api-response-wrapper.md` - Standardized response creation utilities for routes and actions
16. `ARCH-app-business-error.md` - Custom error class with status codes and localized code resolution
17. `ARCH-server-actions-pattern.md` - Server actions with authentication, permissions, and cache invalidation
18. `ARCH-cron-auth-middleware.md` - Constant-time comparison authentication for cron endpoints
19. `ARCH-webhook-signature-verification.md` - HMAC SHA256 signature validation for webhooks

### Forms & Validation (2)

20. `ARCH-zod-schema-validation.md` - Zod schemas for all forms and request payloads
21. `ARCH-react-hook-form-integration.md` - Form handling with react-hook-form and zodResolver

### State & URL (3)

22. `ARCH-url-query-state.md` - URL-based state management hooks for shareable application state
23. `ARCH-tabs-query-sync.md` - Deep-linkable tab state via a registered section registry
24. `ARCH-url-toasts.md` - One-time toast messages invoked via URL query params

### UI Patterns (7)

25. `ARCH-widgets-architecture.md` - `_widgets` folder pattern for organizing page-specific components
26. `ARCH-route-groups.md` - Route groups for layout organization without affecting URL structure
27. `ARCH-loading-state-primitives.md` - Shared loading-state primitives across app UI
28. `ARCH-toast-lifecycle.md` - Shared toast wrapper lifecycle controls
29. `ARCH-dangerous-dialogs.md` - Extra protection layer for confirming destructive actions
30. `ARCH-string-shorteners.md` - Displaying long strings like transaction hashes in readable format
31. `ARCH-semantic-css-tokens.md` - Semantic CSS token contract for cross-app theming
