# [ARCH] - Cron Auth Middleware

## Description

Backend cron endpoints use Bearer token auth with constant-time comparison to avoid timing attacks

## Behavior

- Reads `Authorization: Bearer <secret>`
- Validates the cron secret env var is configured, and fails closed when it is not
- Uses `crypto.timingSafeEqual` after a length check — `timingSafeEqual` throws on length mismatch, so the length check must come first and must itself not short-circuit the comparison for equal-length inputs
- Returns 401 on auth failure

## Related files

- `<monorepo>/apps/backend/src/lib/utils/requireCronAuth.ts`
- `<monorepo>/apps/backend/src/app/cron/**`
- `<monorepo>/apps/backend/src/lib/config/env.ts`
