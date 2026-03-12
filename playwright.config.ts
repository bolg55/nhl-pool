import path from "path";
import { fileURLToPath } from "url";

import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright configuration for NHL Pool E2E tests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: path.resolve(__dirname, "./test-results"),

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI for stability */
  workers: process.env.CI ? 1 : undefined,

  /* Global test timeout: 60 seconds */
  timeout: 60_000,

  /* Assertion timeout: 10 seconds */
  expect: {
    timeout: 10_000,
  },

  /* Reporter configuration */
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/results.xml" }],
    ["list"],
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL for navigation actions */
    baseURL: process.env.BASE_URL || "http://localhost:3000",

    /* Action timeout: 15 seconds (click, fill, etc.) */
    actionTimeout: 15_000,

    /* Navigation timeout: 30 seconds (goto, reload, etc.) */
    navigationTimeout: 30_000,

    /* Collect trace on first retry */
    trace: "retain-on-failure",

    /* Capture screenshot only on failure */
    screenshot: "only-on-failure",

    /* Retain video only on failure */
    video: "retain-on-failure",
  },

  /* Browser projects */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
