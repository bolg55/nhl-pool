/**
 * Authentication helpers for E2E tests.
 *
 * Leverages Better Auth's testUtils plugin for:
 * - Session injection via getCookies() (skip login UI)
 * - OTP capture via getOTP() (no email mocking needed)
 * - Direct user creation/cleanup via createUser/saveUser/deleteUser
 *
 * For tests that need to exercise the actual login UI, use loginViaUi().
 */

import type { BrowserContext, Page } from "@playwright/test";
import type { TestHelpers } from "better-auth/plugins";

// ---------------------------------------------------------------------------
// Session management (using testUtils)
// ---------------------------------------------------------------------------

/**
 * Create a user, inject auth cookies, and return the user ID.
 * This is the fastest way to get an authenticated browser context.
 */
export async function authenticateContext(
  testHelpers: TestHelpers,
  context: BrowserContext,
  options: { email?: string; name?: string; domain?: string } = {},
): Promise<{ userId: string }> {
  const { email = "test@example.com", name = "Test User", domain = "localhost" } = options;

  const user = testHelpers.createUser({ email, name });
  const saved = await testHelpers.saveUser(user);
  const cookies = await testHelpers.getCookies({ userId: saved.id, domain });
  await context.addCookies(cookies);

  return { userId: saved.id };
}

/**
 * Clear the auth session from the browser context.
 */
export async function clearSession(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

// ---------------------------------------------------------------------------
// OTP helpers (using testUtils captureOTP)
// ---------------------------------------------------------------------------

/**
 * Send an OTP and immediately retrieve it via testUtils capture.
 * No email mocking or mailbox polling needed.
 */
export async function sendAndCaptureOtp(testHelpers: TestHelpers, email: string): Promise<string> {
  // Trigger OTP send via the auth API
  await fetch(
    `${process.env.BASE_URL ?? "http://localhost:3000"}/api/auth/email-otp/send-verification-otp`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" }),
    },
  );

  // Retrieve the captured OTP
  const otp = testHelpers.getOTP(email);
  if (!otp) {
    throw new Error(
      `No OTP captured for ${email}. Ensure testUtils({ captureOTP: true }) is enabled.`,
    );
  }
  return otp;
}

// ---------------------------------------------------------------------------
// UI login flow (for testing the login page itself)
// ---------------------------------------------------------------------------

/**
 * Perform the full OTP login flow through the UI.
 * Use this when testing the login page — otherwise prefer authenticateContext().
 */
export async function loginViaUi(
  page: Page,
  testHelpers: TestHelpers,
  email: string,
): Promise<void> {
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("send-otp-button").click();

  // Capture the OTP server-side (no email needed)
  const otp = testHelpers.getOTP(email);
  if (!otp) {
    throw new Error(`No OTP captured for ${email}`);
  }

  await page.getByTestId("otp-input").waitFor({ state: "visible" });
  await page.getByTestId("otp-input").fill(otp);
  await page.getByTestId("verify-otp-button").click();

  await page.waitForURL("**/dashboard");
}
