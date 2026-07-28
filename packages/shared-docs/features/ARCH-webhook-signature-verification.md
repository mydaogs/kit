# [ARCH] - Webhook Signature Verification

## Description

Third-party webhooks are verified with HMAC SHA256 against a signing key before any log or payload processing

## Behavior

- Reads the raw body as a string for HMAC — a parsed-and-restringified body will not match
- Compares against the provider's signature header
- Rejects requests on mismatch, before any handler work
- If a webhook is recreated rather than edited in the provider dashboard, the signing key changes and must be rotated in env or every delivery is rejected

## Related files

- `<monorepo>/apps/backend/src/app/webhooks/<provider>/_utils.ts`
- `<monorepo>/apps/backend/src/app/webhooks/<provider>/route.ts`
- `<monorepo>/apps/backend/src/lib/config/env.ts`
