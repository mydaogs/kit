# Auth permission rules

## Rules description

These rules define the mandatory pattern for checking caller permissions in server actions and API route handlers

## When to use

- Every time you write a server action or API route handler that guards business logic behind a role or permission

## When NOT to use

- Public actions that require no auth check (rare; document the exception inline)

## Rules

- Always use `canAccessAppRole` (for app-level/admin roles) or `canAccessCustomRole` (for org-level custom roles) from the shared permission checkers and never check `user.role` manually
- Never create a `new Set<string>` of role names to compare against and instead add the entity+action to `app-permissions.ts` or `org-permissions.ts` and grant it to the appropriate roles there
- Call the checker as the first async operation inside the action/route `try` block before business logic or DB queries
- Keep permission checks at action/route boundaries by default; keep `src/data/*` focused on reusable data access and caching
- Return `createActionResponse({ error: new APIError("FORBIDDEN", ...) })` immediately when `canAccess` is false
- When adding a new guarded operation first check whether a suitable entity+action already exists in the permissions file before adding a new one
- When the checker returns `appSession`, read user and session data from `access.appSession.user` and `access.appSession.session` instead of calling `getSession` or `requireSession` again in the same action/route; a second session fetch is only justified when a different freshness guard or a distinct session context is intentionally required

## Examples

### Correct app-level admin gate

```ts
const access = await canAccessAppRole(APP_ENTITIES.ENTITY, "review");
if (!access.canAccess) {
  return createActionResponse({
    error: new APIError("FORBIDDEN", { message: "Access denied" }),
  });
}
// Reuse appSession instead of calling getSession again
const { id: userId } = access.appSession.user;
```

### Correct org-level custom role gate

```ts
const result = await canAccessCustomRole(
  ORG_ENTITIES.ENTITY,
  "update",
  [CUSTOM_MEMBER_ROLES.OWNER_ROLE],
);
if (!result.canAccess) {
  return createActionResponse({
    error: new APIError("FORBIDDEN", { message: "Access denied" }),
  });
}
// Reuse appSession; organizationId/memberId/customRole remain top-level
const { id: userId, email: userEmail } = result.appSession.user;
const { organizationId, memberId, customRole } = result;
```

### Wrong hardcoded role set

```ts
const ALLOWED = new Set<string>([
  APP_ROLES.PROJECT_ADMIN_ROLE,
  APP_ROLES.PROJECT_SUPERADMIN_ROLE,
]);
const { user } = await requireSession();
if (!ALLOWED.has(user.role)) {
  return createActionResponse({ error: new Error("Access denied") });
}
```
