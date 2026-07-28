# Tech Stack (Monorepo + Next.js + Prisma + Foundry)

## Context

The product combines:

- A web application for authenticated product workflows
- A blockchain layer for identity, incentives, and value-bearing logic

We need a stack that supports fast product iteration, strong type-safety, server-side security boundaries, and a reliable smart contract toolchain

## Decision

- Use a **pnpm + Turborepo monorepo** for apps and shared packages (`<monorepo>/`)
- Use **Next.js App Router** (React server-first) for the main app, the backend app, and any content site
- Use **Prisma ORM + MongoDB** for application-layer persistence (`@shared/db`)
- Use **Foundry** for smart contract development, testing, and deployment (`<contracts>/`)
- Use a shared **UI package** (`@shared/ui`) and shared ESLint/TS configs for consistency

## Consequences

Positive:

- Shared packages reduce duplication (UI + DB client)
- Server-first Next.js keeps auth/RBAC and secrets on the server by default
- Foundry provides a strong testing story for contracts

Tradeoffs:

- Two runtimes/domains of truth (app DB vs chain state) require careful boundary management
- Fast-moving Next.js/React versions may introduce churn; rely on lockfiles and build checks
