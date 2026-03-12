/**
 * Playwright Fixture Index
 *
 * Base test extended from @playwright/test with custom fixtures leveraging
 * Better Auth's testUtils plugin for:
 * - Authenticated pages (via testUtils.getCookies)
 * - User creation and cleanup (via testUtils.createUser/saveUser/deleteUser)
 * - OTP capture (via testUtils.getOTP)
 *
 * Usage:
 *   import { test, expect } from '../support/fixtures';
 */

import { test as base, expect, mergeTests, type BrowserContext, type Page } from "@playwright/test";
import type { TestHelpers } from "better-auth/plugins";

import { getTestHelpers } from "../test-auth";

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Authenticated page fixture — a Playwright Page with an active session. */
export interface AuthenticatedPageFixture {
  page: Page;
  context: BrowserContext;
  userId: string;
}

/** Options that can be overridden via test.use(). */
export interface CustomFixtureOptions {
  baseURL: string;
  testUserEmail: string;
  testUserName: string;
}

/** All custom fixtures exposed to tests. */
export interface CustomFixtures {
  /** Better Auth test helpers (factories, auth, OTP capture). */
  testHelpers: TestHelpers;
  /** An authenticated page with an active Better Auth session. */
  authenticatedPage: AuthenticatedPageFixture;
}

// ---------------------------------------------------------------------------
// Custom Fixtures
// ---------------------------------------------------------------------------

const customTest = base.extend<CustomFixtures & CustomFixtureOptions>({
  // -- Options (overridable via test.use()) ---------------------------------
  baseURL: [process.env.BASE_URL ?? "http://localhost:3000", { option: true }],
  testUserEmail: [process.env.TEST_USER_EMAIL ?? "test@example.com", { option: true }],
  testUserName: [process.env.TEST_USER_NAME ?? "Test User", { option: true }],

  // -- Fixtures -------------------------------------------------------------

  testHelpers: async ({}, use) => {
    const helpers = await getTestHelpers();
    await use(helpers);
  },

  authenticatedPage: async (
    { browser, baseURL, testUserEmail, testUserName, testHelpers },
    use,
  ) => {
    // 1. Create and persist a user via Better Auth testUtils
    const userData = testHelpers.createUser({
      email: testUserEmail,
      name: testUserName,
    });
    const savedUser = await testHelpers.saveUser(userData);

    // 2. Get Playwright-compatible cookies from testUtils
    const domain = new URL(baseURL).hostname;
    const cookies = await testHelpers.getCookies({
      userId: savedUser.id,
      domain,
    });

    // 3. Create an isolated browser context with auth cookies
    const context = await browser.newContext({ baseURL });
    await context.addCookies(cookies);

    const page = await context.newPage();

    await use({ page, context, userId: savedUser.id });

    // Teardown — clean up user and close context
    await testHelpers.deleteUser(savedUser.id);
    await context.close();
  },
});

// ---------------------------------------------------------------------------
// Merged Test Export
// ---------------------------------------------------------------------------

/**
 * When @seontechnologies/playwright-utils is installed, uncomment and merge:
 *
 *   import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
 *   import { test as authFixture } from '@seontechnologies/playwright-utils/auth-session/fixtures';
 *   import { test as logFixture } from '@seontechnologies/playwright-utils/log/fixtures';
 *
 *   export const test = mergeTests(apiRequestFixture, authFixture, logFixture, customTest);
 */
export const test = customTest;

export { expect, mergeTests };
