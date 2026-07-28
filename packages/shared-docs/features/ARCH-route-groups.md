# [ARCH] - Route Groups

## Description

Next.js route groups organize routes by context and role without affecting URLs. Layouts apply auth, role, and onboarding guards at group boundaries

## Behavior

- A modal-hosting group wraps authenticated routes and modal slots, and hosts the shared onboarding guard for signed-in users without an active organization
- A main group provides the signed-in shell
- Role groups under the main group apply a client role guard, including shared groups covering several related roles
- A public-user group holds flows that need no role guard
- Onboarding is a non-blocking persistent toast nudge at the outer group, while settings modals keep their own modal-scoped auth guard

## Guard placement rule

Put a guard at the highest boundary that all its protected routes share, and nowhere else. A guard duplicated at both a group layout and a leaf produces two redirects racing each other — which is one of the preconditions for the router action-queue defect described in `decisions/nextjs-runtime-and-cache-components.md`. Make one component the sole post-auth navigation owner

## Related files

- `<monorepo>/apps/app/src/app/**/layout.tsx`
- `<monorepo>/apps/app/src/components/Guards/`
