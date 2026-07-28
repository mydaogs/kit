# Admin signature rules

## Rules description

These rules define the mandatory wallet-signature requirement for admin actions

## When to use

- Every time you implement or modify an admin-only action, API route, or privileged mutation

## When NOT to use

- Non-admin user flows
- Read-only public endpoints

## Rules

- All admin actions MUST be submitted with a wallet signature from the acting admin wallet
- Signature verification MUST happen before executing business logic or database writes
- The signer wallet MUST resolve to a valid admin role onchain
- Requests without a valid wallet signature MUST return `FORBIDDEN`
- Do not rely only on email/magic-link identity for admin action authorization
- Signed payloads MUST include replay protection. At minimum this means a unique `nonce` plus `expiresAt`, and the server MUST reject reused or expired payloads before business logic or DB writes
- Signed payloads MUST bind the intent to the target resource. Include `targetId` (or equivalent resource key) for targeted admin actions so one valid signature cannot be replayed against a different entity
- Canonical signed payload MUST include at least: `action`, `adminAddress`, `chainId`, `nonce`, `expiresAt`; include `targetId` for entity-specific actions, and consider `payloadHash` for mutable bodies
- Nonce uniqueness (or counter monotonicity) and `expiresAt` validation MUST be enforced server-side. Client-generated timestamps without server checks do not count as replay protection
- Failed nonce, target-binding, chain, signer, or expiry validation MUST return `FORBIDDEN`
- Prefer shared helpers for signed payload construction and server-side freshness checks so client/server message formats cannot drift
- Nonces are consumed server-side through KV-backed freshness checks before the admin role lookup or mutation logic continues

## User-only restrictions for admin accounts

- Admin app roles MUST NOT access user-only account actions (email change, account context switching, notification toggles, report submission, organization creation requests)
- User-only actions MUST be expressed as explicit app permissions instead of overloaded entities (for example `USER_SUBMISSION.*`)
- For auth endpoints that bypass app permission checks (such as `/change-email`), enforce restrictions in auth-level hooks/middleware
- For session mutation flows that bypass app permission checks (such as active organization switching), enforce restrictions in DB auth hooks
- UI hiding is optional and secondary; server and auth layers are mandatory enforcement layers

## Examples

### Correct signed admin action flow

```ts
const message = createAdminActionSignatureMessage({
  action: ADMIN_SIGNATURE_ACTIONS.REVIEW_ENTITY,
  adminAddress: address,
  targetId: organizationId,
});

const admin = await getWeb3AdminUser({ address, message, signature });
if (!admin) {
  return createActionResponse({
    error: new APIError("FORBIDDEN", { message: "Not an admin" }),
  });
}

// execute admin mutation after signature + onchain role validation
```

### Wrong unsigned admin action flow

```ts
const { user } = await requireSession();
if (user.role !== APP_ROLES.PROJECT_ADMIN_ROLE) {
  return createActionResponse({ error: new APIError("FORBIDDEN") });
}

// missing wallet signature validation
```
