# [ARCH] - Server Actions Pattern

## Description

All client-callable mutations live under `<monorepo>/apps/app/src/actions`. Actions run server-side, enforce session and permissions, validate input, forward the write, and return standardized discriminated-union responses. Server-only helpers that are not meant to be imported by client modules live under `<monorepo>/apps/app/src/lib/utils/server`

## Behavior

- `"use server"` at top of the file
- `src/actions/index.ts` stays client-safe and re-exports only real server actions
- Server-only helpers such as transactional email utilities stay outside `src/actions` and are imported from `src/lib/utils/server`
- Validate input with Zod schemas before any writes
- Use `requireSession`, `canAccessCustomRole`, and `canAccessAppRole` for access control
- Wrap multi-step writes in a database transaction
- Throw `APIError` for consistent error formatting
- Return `{ success: true, data }` or `{ success: false, errorMessage }` via `createActionResponse`
- Invalidate cache tags after writes, applying tags returned by the backend response envelope with `updateTag()`

## Standard action pattern

```typescript
"use server";

import { z } from "zod";
import { APIError } from "better-auth/api";
import { requireSession } from "@/lib/auth/requireSession";
import { canAccessAppRole } from "@/lib/auth/permissions/checkers";
import { createActionResponse } from "@/lib/utils/createActionResponse";
import { backendFetch } from "@/lib/backend/serverClient";
import { updateTag } from "next/cache";

const inputSchema = z.object({
  name: z.string().min(1),
});

type Input = z.infer<typeof inputSchema>;

export const createThing = async (input: Input) => {
  try {
    await requireSession();

    const access = await canAccessAppRole(APP_ENTITIES.ENTITY, "create");
    if (!access.canAccess) {
      throw new APIError("FORBIDDEN", { message: "Access denied" });
    }

    const parsed = inputSchema.parse(input);

    const result = await backendFetch<string>("/data/createEntity", {
      method: "POST",
      body: parsed,
      onCacheTags: (tags) => tags.forEach(updateTag),
    });

    return createActionResponse({ data: result });
  } catch (error) {
    return createActionResponse({ error });
  }
};
```

The action performs a local gate for UI intent; the backend re-authenticates and re-validates permissions independently. Neither side trusts the other's check

## Related files

- `<monorepo>/apps/app/src/actions`
- `<monorepo>/apps/app/src/actions/index.ts`
- `<monorepo>/apps/app/src/lib/utils/createActionResponse.ts`
- `<monorepo>/apps/app/src/lib/backend/serverClient.ts`
- `<monorepo>/apps/app/src/lib/schemas`
