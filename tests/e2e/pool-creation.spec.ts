import { test, expect } from "../support/fixtures";

test.describe("Pool Creation & Organization Setup", () => {
  test("authenticated user sees Create Pool CTA on empty dashboard", async ({
    browser,
    testHelpers,
  }) => {
    const email = `pool-cta-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "CTA Test User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");

      await expect(page.getByText("Create Your First Pool")).toBeVisible();
      await expect(page.getByLabel("Pool Name")).toBeVisible();
      await expect(page.getByRole("button", { name: "Create Pool" })).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("user can create a pool and is redirected to pool dashboard", async ({
    browser,
    testHelpers,
  }) => {
    const email = `pool-create-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Create Test User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");
      await expect(page.getByText("Create Your First Pool")).toBeVisible();

      const poolName = `Test Pool ${Date.now()}`;
      const input = page.getByLabel("Pool Name");
      await input.click();
      await input.fill(poolName);
      await input.dispatchEvent("input");

      const createBtn = page.getByRole("button", { name: "Create Pool" });
      await createBtn.click();

      // Should redirect to pool dashboard
      await page.waitForURL(/\/p\/[a-z0-9-]+\/dashboard/, { timeout: 15000 });

      // Pool dashboard should show the pool name
      await expect(page.getByText(poolName)).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("pool name validation rejects names that are too short", async ({
    browser,
    testHelpers,
  }) => {
    const email = `pool-short-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Short Name User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");

      await page.getByLabel("Pool Name").fill("Ab");
      await page.getByLabel("Pool Name").blur();

      await expect(page.getByText("Pool name must be at least 3 characters")).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("pool name validation rejects empty names", async ({ browser, testHelpers }) => {
    const email = `pool-empty-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Empty Name User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");

      await page.getByLabel("Pool Name").focus();
      await page.getByLabel("Pool Name").blur();

      await expect(page.getByText("Pool name must be at least 3 characters")).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("pool owner can access admin page", async ({ browser, testHelpers }) => {
    const email = `pool-admin-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Admin Test User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      // Create a pool first
      await page.goto("/dashboard");
      const input = page.getByLabel("Pool Name");
      await input.click();
      await input.pressSequentially("Admin Test Pool");
      await page.getByRole("button", { name: "Create Pool" }).click();

      // Wait for redirect to pool dashboard
      await page.waitForURL(/\/p\/[a-z0-9-]+\/dashboard/, { timeout: 15000 });

      // Navigate to admin page via the URL
      const url = page.url();
      const slug = url.match(/\/p\/([a-z0-9-]+)\//)?.[1];
      await page.goto(`/p/${slug}/admin`);

      // Admin page should load
      await expect(page.getByText("Pool Settings")).toBeVisible();
      await expect(page.getByText("Admin Test Pool")).toBeVisible();
      await expect(page.getByText("Pool Configuration")).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("non-owner cannot access admin page", async ({ browser, testHelpers }) => {
    const email = `pool-nonadmin-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Non-Admin User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      // Navigate to a pool admin page they're not a member of
      await page.goto("/p/nonexistent-pool/admin");

      // Should be redirected to dashboard (pool layout catches non-members)
      await page.waitForURL("/dashboard", { timeout: 10000 });
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });
});
