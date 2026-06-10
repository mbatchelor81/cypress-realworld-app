---
name: add-backend-api-route
description: Add a new Express API route to the RWA backend. Use when adding endpoints — covers route files, Supabase queries, validators, type definitions, and test patterns.
---

# Add Backend API Route

This skill walks through adding a new API endpoint to the Real World App's Express backend.

## Backend Structure

```
backend/
├── app.ts                     # Express app setup, middleware, route mounting
├── database.ts                # Data access layer (Supabase queries)
├── supabase-client.ts         # Supabase client initialization
├── auth.ts                    # Auth middleware (JWT verification)
├── helpers.ts                 # Shared utilities
├── validators.ts              # Input validation functions
├── types.ts                   # Backend-specific type definitions
├── user-routes.ts             # /users endpoints
├── transaction-routes.ts      # /transactions endpoints
├── bankaccount-routes.ts      # /bankaccounts endpoints
├── banktransfer-routes.ts     # /banktransfers endpoints
├── contact-routes.ts          # /contacts endpoints
├── notification-routes.ts     # /notifications endpoints
├── like-routes.ts             # /likes endpoints
└── comment-routes.ts          # /comments endpoints
```

## Steps

### 1. Define types

Add request/response types in `backend/types.ts` or `src/models/`:

```typescript
export interface NewResourcePayload {
  fieldName: string;
  optionalField?: number;
}
```

### 2. Add data access function

Add the database function in `backend/database.ts`. The app uses Supabase for data persistence:

```typescript
// Read pattern
const getResourceById = async (resourceId: string) => {
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .single();
  if (error) throw error;
  return data;
};

// Write pattern
const createResource = async (payload: NewResourcePayload) => {
  const id = shortid();
  const { data, error } = await supabase
    .from("resources")
    .insert({ id, ...payload, createdAt: new Date(), modifiedAt: new Date() })
    .select()
    .single();
  if (error) throw error;
  return data;
};
```

### 3. Add input validation

Add validators in `backend/validators.ts` using `express-validator` (the project standard):

```typescript
import { body } from "express-validator";

export const isResourcePayloadValidator = [
  body("fieldName").isString().trim().notEmpty(),
  body("optionalField").optional({ checkFalsy: true }).isNumeric(),
];
```

### 4. Create the route file

Create `backend/<resource>-routes.ts`. Use `validateMiddleware` from `helpers.ts` to wire up validation:

```typescript
import express from "express";
import { ensureAuthenticated } from "./auth";
import { validateMiddleware } from "./helpers";
import { isResourcePayloadValidator } from "./validators";

const router = express.Router();

// All routes require authentication
router.get("/", ensureAuthenticated, async (req, res) => {
  const { user } = req;
  // ... query and return data
});

router.post("/", ensureAuthenticated, validateMiddleware(isResourcePayloadValidator), async (req, res) => {
  // Create resource
  // Return 201 with created resource
});

export default router;
```

### 5. Mount the router

In `backend/app.ts`, import and mount:

```typescript
import resourceRoutes from "./<resource>-routes";
app.use("/<resources>", resourceRoutes);
```

### 6. Add tests

Add API tests in `cypress/tests/api/api-<resource>.spec.ts` following the [add-cypress-e2e-test](../add-cypress-e2e-test/SKILL.md) skill.

### 7. Verify

```bash
# Start dev server
yarn dev

# Run API tests
yarn test:api

# Run lint
yarn lint
```

## Patterns to Follow

- **Authentication**: All mutation endpoints use `ensureAuthenticated` middleware
- **IDs**: Generate with `shortid()` — never auto-increment
- **Timestamps**: Always set `createdAt` and `modifiedAt` on create, update `modifiedAt` on update
- **Error handling**: Return appropriate HTTP status codes (400, 404, 422)
- **Supabase client**: Import from `backend/supabase-client.ts`
