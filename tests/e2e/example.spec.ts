import { test, expect } from "../support/fixtures";

/**
 * Example E2E test demonstrating recommended patterns:
 * - Better Auth testUtils for authenticated sessions
 * - Network-first interception (register BEFORE navigation)
 * - data-testid selector strategy
 * - Given/When/Then structure via comments
 * - Deterministic waits (no hard timeouts)
 */

test.describe("Pool Dashboard", () => {
  test("displays pool list for authenticated user", async ({ authenticatedPage: { page } }) => {
    const pool = { id: "pool-1", name: "Office Hockey Pool", season: "2025-2026" };

    // Given: the API returns a list of pools
    await page.route("**/api/pools", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([pool]),
      }),
    );

    // Given: set up response promise BEFORE navigating (network-first)
    const poolsPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/pools") && resp.status() === 200,
    );

    // When: the user navigates to the dashboard
    await page.goto("/dashboard");
    await poolsPromise;

    // Then: the pool name is visible
    await expect(page.getByTestId("pool-list")).toBeVisible();
    await expect(page.getByText(pool.name)).toBeVisible();
  });

  test("shows empty state when no pools exist", async ({ authenticatedPage: { page } }) => {
    // Given: the API returns an empty pool list
    await page.route("**/api/pools", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    const poolsPromise = page.waitForResponse("**/api/pools");

    // When: the user navigates to the dashboard
    await page.goto("/dashboard");
    await poolsPromise;

    // Then: the empty state message is displayed
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });

  test("handles server error gracefully", async ({ authenticatedPage: { page } }) => {
    // Given: the API returns a 500 error
    await page.route("**/api/pools", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );

    const poolsPromise = page.waitForResponse("**/api/pools");

    // When: the user navigates to the dashboard
    await page.goto("/dashboard");
    await poolsPromise;

    // Then: a user-friendly error message is shown
    await expect(page.getByTestId("error-message")).toBeVisible();
  });
});
