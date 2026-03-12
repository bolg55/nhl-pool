import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Test Auth Setup
 *
 * Creates a Better Auth instance with the testUtils plugin for use in
 * Playwright fixtures and test setup. This is separate from the production
 * auth config because:
 *   1. Production auth uses @tanstack/react-start/server-only guards
 *   2. We need the testUtils plugin (test-only, never in production)
 *   3. Tests need direct DB access for factories and cleanup
 *
 * Usage:
 *   import { getTestHelpers } from '../support/test-auth';
 *   const test = await getTestHelpers();
 *   const user = test.createUser({ email: 'test@example.com' });
 */

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Database (standalone connection for tests — no server-only guard)
// ---------------------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for test auth setup");
}

const client = postgres(databaseUrl);
const db = drizzle({ client, casing: "snake_case" });

// ---------------------------------------------------------------------------
// Auth instance with testUtils plugin
// ---------------------------------------------------------------------------

export const testAuth = betterAuth({
  baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "test-secret-do-not-use-in-prod",
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    emailOTP({
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        // In test mode, OTPs are captured by testUtils — no email sending needed
        console.log(`[test] OTP for ${email} (${type}): ${otp}`);
      },
    }),
    testUtils({ captureOTP: true }),
  ],
});

// ---------------------------------------------------------------------------
// Test helpers accessor
// ---------------------------------------------------------------------------

let cachedHelpers: TestHelpers | null = null;

/**
 * Get Better Auth test helpers (factories, auth helpers, OTP capture).
 * Results are cached for the process lifetime.
 */
export async function getTestHelpers(): Promise<TestHelpers> {
  if (cachedHelpers) return cachedHelpers;

  const ctx = await testAuth.$context;
  cachedHelpers = ctx.test;
  return cachedHelpers;
}

/**
 * Clean up the database connection. Call in global teardown.
 */
export async function closeTestDb(): Promise<void> {
  await client.end();
}
