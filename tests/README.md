# Test Suite

End-to-end and contract testing for the NHL Pool application.

## Setup

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Bun package manager
- PostgreSQL database running (for test auth setup)

### Install Dependencies

```bash
bun add -D @playwright/test @faker-js/faker
npx playwright install
```

### Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Key test variables:

| Variable             | Description                        | Default                     |
| -------------------- | ---------------------------------- | --------------------------- |
| `TEST_ENV`           | Test environment name              | `local`                     |
| `BASE_URL`           | Application URL                    | `http://localhost:3000`     |
| `API_URL`            | API base URL                       | `http://localhost:3000/api` |
| `DATABASE_URL`       | PostgreSQL connection              | required                    |
| `BETTER_AUTH_SECRET` | Auth secret for test auth instance | required                    |

## Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run in headed mode (see browser)
bun run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/example.spec.ts

# Run in debug mode (step through)
npx playwright test --debug

# Run with UI mode (interactive)
npx playwright test --ui

# View last test report
npx playwright show-report
```

### Contract Tests (Pact)

```bash
# Run consumer contract tests
bun run test:pact:consumer

# Publish pacts to broker
bun run publish:pact

# Check deployment compatibility
bun run can:i:deploy:consumer

# Record deployment
bun run record:consumer:deployment
```

## Architecture

```
tests/
├── e2e/                          # E2E test specs
│   └── example.spec.ts           # Sample tests with recommended patterns
├── contract/                     # Pact consumer contract tests
│   ├── consumer/                 # Consumer test files (.pacttest.ts)
│   └── support/                  # Pact config, provider states, helpers
├── support/
│   ├── test-auth.ts              # Better Auth instance with testUtils plugin
│   ├── fixtures/
│   │   ├── index.ts              # Fixture index (testHelpers, authenticatedPage)
│   │   └── factories/
│   │       ├── index.ts          # Factory barrel exports
│   │       └── user.factory.ts   # Faker-based user data builder
│   ├── helpers/
│   │   ├── index.ts              # Helper barrel exports
│   │   ├── auth.helper.ts        # Auth helpers (OTP capture, session injection)
│   │   ├── api.helper.ts         # Typed API client wrapper
│   │   └── network.helper.ts     # Network interception utilities
│   └── page-objects/             # Page object models (add as needed)
└── README.md                     # This file
```

### Key Patterns

#### Better Auth testUtils Integration

Tests use Better Auth's `testUtils` plugin for auth operations:

```typescript
import { test } from "../support/fixtures";

// authenticatedPage fixture automatically:
// 1. Creates a user via testHelpers.createUser() + saveUser()
// 2. Gets Playwright cookies via testHelpers.getCookies()
// 3. Injects cookies into an isolated browser context
// 4. Cleans up the user on teardown
test("protected page", async ({ authenticatedPage: { page } }) => {
  await page.goto("/dashboard");
  // ... assertions
});

// Access testHelpers directly for custom flows:
test("custom auth", async ({ testHelpers }) => {
  const user = testHelpers.createUser({ email: "custom@test.com" });
  const saved = await testHelpers.saveUser(user);
  // ... use saved.id
  await testHelpers.deleteUser(saved.id);
});
```

#### OTP Capture

No email mocking needed — testUtils captures OTPs server-side:

```typescript
import { sendAndCaptureOtp } from "../support/helpers/auth.helper";

test("OTP flow", async ({ testHelpers }) => {
  const otp = await sendAndCaptureOtp(testHelpers, "user@test.com");
  // otp is the actual code, captured without sending email
});
```

#### Network-First Interception

Always register route handlers BEFORE navigation:

```typescript
// Set up interception FIRST
await page.route("**/api/data", (route) =>
  route.fulfill({ status: 200, body: JSON.stringify(mockData) }),
);
const responsePromise = page.waitForResponse("**/api/data");

// THEN navigate
await page.goto("/page");
await responsePromise;
```

#### Selectors

Use `data-testid` attributes for resilient selectors:

```typescript
await page.getByTestId("submit-button").click();
await expect(page.getByTestId("success-message")).toBeVisible();
```

## Best Practices

- **Isolation**: Each test gets its own user and browser context via fixtures
- **Cleanup**: testUtils handles user cleanup automatically in fixture teardown
- **No hard waits**: Use `waitForResponse`, `waitForURL`, `toBeVisible()` — never `page.waitForTimeout()`
- **Given/When/Then**: Structure tests with comments for readability
- **Factory data**: Use `buildUser()` for in-memory data, `testHelpers.saveUser()` for DB-persisted data

## CI Integration

- Playwright config auto-detects CI via `process.env.CI`
- CI mode: 1 worker, 2 retries, `forbidOnly: true`
- Artifacts (traces, screenshots, videos) captured only on failure
- Reports: HTML + JUnit XML for CI dashboards
- Pact consumer CDC runs via `.github/workflows/contract-test-consumer.yml`

## Troubleshooting

**Tests fail with "DATABASE_URL is required"**

- Ensure `.env` has a valid `DATABASE_URL` — the test auth setup needs direct DB access

**OTP capture returns undefined**

- Ensure `testUtils({ captureOTP: true })` is in the test auth config (`tests/support/test-auth.ts`)
- OTP capture is passive — it doesn't prevent email sending, just stores a copy

**Browser not installed**

- Run `npx playwright install` to download browser binaries

**Tests timeout on CI**

- Check `BASE_URL` points to a running app instance
- Increase timeout in `playwright.config.ts` if needed
