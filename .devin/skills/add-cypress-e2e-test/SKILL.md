---
name: add-cypress-e2e-test
description: Write E2E or API tests following existing Cypress patterns in the RWA. Use when adding test coverage for new features, regression tests, or expanding the test suite.
---

# Add Cypress E2E Test

This skill walks through writing Cypress tests for the Real World App, following existing patterns.

## Test Organization

```
cypress/tests/
├── ui/                    # Browser-based E2E tests
│   ├── auth.spec.ts
│   ├── bankaccounts.spec.ts
│   ├── new-transaction.spec.ts
│   ├── notifications.spec.ts
│   ├── transaction-feeds.spec.ts
│   ├── transaction-view.spec.ts
│   └── user-settings.spec.ts
├── api/                   # API-level tests (no browser)
│   ├── api-transactions.spec.ts
│   ├── api-users.spec.ts
│   ├── api-bankaccounts.spec.ts
│   └── ...
└── demo/                  # Demo-specific test scenarios
```

## Prerequisites

- Dev server running: `yarn dev` (frontend :3000 + backend :3001)
- Database seeded: `yarn db:seed`

## Steps

### 1. Choose test type

| Type | Location | When to use |
|------|----------|-------------|
| **UI E2E** | `cypress/tests/ui/` | User flows through the browser |
| **API** | `cypress/tests/api/` | Backend endpoint contracts |
| **Component** | `src/components/*.cy.tsx` | Isolated React component testing |

### 2. Write a UI E2E test

```typescript
describe("Feature Name", () => {
  beforeEach(() => {
    // Seed DB and login programmatically
    cy.task("db:seed");
    cy.database("find", "users").then((user: User) => {
      cy.loginByXstate(user.username);
    });
  });

  it("should perform expected behavior", () => {
    // Use data-test selectors
    cy.getBySel("nav-item").click();

    // Assert on visible content
    cy.getBySel("result-list").should("be.visible");
    cy.getBySel("result-item").should("have.length.greaterThan", 0);
  });
});
```

### 3. Write an API test

```typescript
describe("API: Resource Name", () => {
  beforeEach(() => {
    cy.task("db:seed");
    cy.database("find", "users").then((user: User) => {
      cy.loginByApi(user.username).then((resp) => {
        // Store auth token for subsequent requests
      });
    });
  });

  it("GET /resource — returns list", () => {
    cy.request("GET", "/resource").then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body.results).to.be.an("array");
    });
  });
});
```

### 4. Use custom commands

| Command | Purpose |
|---------|---------|
| `cy.getBySel("selector")` | Select by `data-test` attribute |
| `cy.loginByXstate(username)` | Programmatic login via XState |
| `cy.loginByApi(username)` | Login via API call |
| `cy.database("find", "users")` | Query the local database |
| `cy.task("db:seed")` | Reset and seed the database |

### 5. Run tests

```bash
# Interactive mode
yarn cypress:open

# Headless (CI)
yarn test:headless

# API tests only
yarn test:api

# Component tests only
yarn test:component:ci
```

## Naming Conventions

- Test files: `<feature>.spec.ts` (UI) or `api-<resource>.spec.ts` (API)
- Describe blocks: Feature or resource name
- It blocks: `should <expected behavior>` — e.g., `should display transaction list`
- Selectors: Use `data-test` attributes via `cy.getBySel()`

## Key Patterns

- **Programmatic login**: Always use `cy.loginByXstate()` — never test through the login UI unless testing auth itself
- **Database seeding**: Call `cy.task("db:seed")` in `beforeEach` for test isolation
- **No hardcoded IDs**: Query the database for IDs dynamically via `cy.database()`
- **Assertions on visible state**: Use `.should("be.visible")` and `.should("contain")` over DOM structure checks
