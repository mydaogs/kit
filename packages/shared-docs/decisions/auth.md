# Authentication (Better Auth + Magic Link + Web3 Admin)

## Context

The app requires:

- Multiple login methods (email magic link for most users, wallet signature for admin roles, social OAuth for identity confirmation)
- Session-based "active organization" context (users can belong to multiple organizations of different types)
- Strong RBAC enforcement on server actions and data reads
- Secure bot protection for entry points

## Decision

- Use **Better Auth** with custom plugins:
  - Magic link email authentication (default for most roles)
  - Captcha integration for anti-bot
  - Organization and RBAC plugins (app roles + org roles + derived roles)
  - Trusted-user / Web3 signature flow for admin sign-in, using replay-safe signed payloads with nonce + expiry checks
- Store **active organization context** on the session (active org id, active member id, org type/name/role)
- Support social OAuth where a real-identity confirmation step is needed

## Two-tier role model

Keep app-level roles and organization-level roles separate, then derive a single "custom member role" from the pair:

- app roles gate platform capabilities (admin tiers, ordinary user)
- org roles gate membership capabilities within one organization (owner, member)
- the derived role is what UI and org-scoped permission checks consume, so a member's effective role is computed once instead of re-derived at each call site

## Session reads

- Server-only `getSession` returns `AppSession | null` (treats missing/invalid/expired session as signed out)
- Use `requireSession` when authentication is required (throws `APIError("UNAUTHORIZED")`)
- The client session hook reads the session endpoint and does not auto-retry on error

## Session enrichment

Enrich the session with organization context and any onchain-derived status at read time, cached in KV under a version-keyed prefix, and invalidate that cache on every identity-relevant mutation (org switch, ban projection, wallet binding). This is what makes a stale-allowed session read safe by construction rather than by omission

## Consequences

Positive:

- Centralized auth/session logic simplifies RBAC and route protection
- Magic links reduce password management risk and UX friction for non-web3 users
- Web3 admin sign-in aligns with onchain governance and trust-anchor roles

Tradeoffs:

- Auth flows rely on external integrations (auth library, SMTP provider, captcha, OAuth providers)
- Cross-subdomain/session behavior requires careful cookie configuration

## Ban compatibility

- The auth library's default `User.banned` field stays unused for entity bans derived from chain state
- Session ban fields are derived from indexed onchain entity ban projections, not from `User.banned`
