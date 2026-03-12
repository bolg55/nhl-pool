import { test, expect } from "@playwright/test";

/**
 * Diagnostic test to capture the full OTP sign-in flow and identify
 * where the "invalid OTP" error originates — even though the session
 * is actually created (dashboard loads on refresh).
 */
test.describe("OTP Sign-In Flow Debug", () => {
  test("capture full OTP network activity", async ({ page }) => {
    test.setTimeout(180_000); // 3 minutes for manual OTP entry

    // Collect ALL network requests/responses (not just auth)
    const allRequests: {
      url: string;
      method: string;
      status: number;
      body: string;
      setCookie: string | null;
      requestCookie: string | null;
      timing: number;
    }[] = [];

    const startTime = Date.now();

    page.on("response", async (response) => {
      const url = response.url();
      const status = response.status();
      const method = response.request().method();
      const timing = Date.now() - startTime;

      // Log ALL 4xx/5xx errors
      if (status >= 400) {
        console.log(`  [${timing}ms] ERROR ${status} ${method} ${url}`);
      }

      // Capture auth endpoints, server functions, and any errors
      if (
        url.includes("/api/auth") ||
        url.includes("__server-fns") ||
        url.includes("_server") ||
        status >= 400
      ) {
        let body = "";
        try {
          body = await response.text();
        } catch {
          body = "<could not read body>";
        }
        allRequests.push({
          url,
          method,
          status,
          body: body.substring(0, 500),
          setCookie: response.headers()["set-cookie"] ?? null,
          requestCookie: response.request().headers()["cookie"] ?? null,
          timing,
        });
      }
    });

    // Capture failed requests (network errors, not HTTP errors)
    page.on("requestfailed", (request) => {
      console.log(
        `  [${Date.now() - startTime}ms] REQUEST FAILED: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`,
      );
    });

    // Collect console messages (all types, not just errors)
    const consoleLogs: { type: string; text: string; timing: number }[] = [];
    page.on("console", (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        timing: Date.now() - startTime,
      };
      consoleLogs.push(entry);
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`  [${entry.timing}ms] CONSOLE.${msg.type()}: ${msg.text()}`);
      }
    });

    // Collect page errors (unhandled exceptions)
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      console.log(`  [${Date.now() - startTime}ms] PAGE ERROR: ${err.message}`);
      pageErrors.push(err.message);
    });

    // 1. Navigate to sign-in
    await page.goto("/auth/sign-in");
    await page.waitForLoadState("domcontentloaded");

    console.log("\n=== STEP 1: Sign-in page loaded ===");
    console.log("URL:", page.url());

    // Dump cookies before sign-in
    const cookiesBefore = await page.context().cookies();
    console.log(
      "Cookies before sign-in:",
      cookiesBefore.map((c) => `${c.name}=${c.value.substring(0, 20)}...`).join(", ") || "none",
    );

    // 2. Find and fill the email input
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    const testEmail = process.env.TEST_USER_EMAIL || "kellen@kellenbolger.ca";
    await emailInput.click();
    await emailInput.press("Control+a");
    await emailInput.press("Backspace");
    await page.waitForTimeout(200);
    await page.keyboard.type(testEmail, { delay: 80 });

    console.log("\n=== STEP 2: Email entered ===");
    console.log("Email:", testEmail);

    // 3. Submit the email to send OTP
    const sendButton = page.locator('button[type="submit"]');
    await sendButton.click();

    const sendResponse = await page.waitForResponse(
      (res) => res.url().includes("send-verification-otp"),
      { timeout: 15_000 },
    );

    console.log("\n=== STEP 3: OTP Send Response ===");
    console.log("Status:", sendResponse.status());
    console.log("Body:", await sendResponse.text().catch(() => "<no body>"));

    // 4. Wait for OTP input to appear
    const otpContainer = page.locator("[data-input-otp]").first();
    await expect(otpContainer).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "test-results/debug-otp-after-send.png" });
    console.log("\n=== STEP 4: OTP input visible ===");

    // 5. Get OTP via testUtils or manual entry
    let otp: string | undefined;

    try {
      const { getTestHelpers } = await import("../support/test-auth");
      const helpers = await getTestHelpers();
      otp = helpers.getOTP(testEmail);
      console.log("OTP captured via testUtils:", otp ? `YES (${otp})` : "NO");
    } catch (e) {
      console.log("Could not use testUtils for OTP capture:", (e as Error).message);
    }

    await otpContainer.click();

    if (!otp) {
      console.log("\n=== MANUAL OTP ENTRY REQUIRED ===");
      console.log("Check your email for the OTP and type it in the browser window.");
      console.log("The test will wait up to 2 minutes...");

      await page.waitForResponse(
        (res) => res.url().includes("sign-in/email-otp") || res.url().includes("verify"),
        { timeout: 120_000 },
      );
    } else {
      console.log("\n=== STEP 5: Entering OTP ===");
      await page.keyboard.type(otp, { delay: 150 });
      console.log("OTP entered, waiting for auto-submit...");
    }

    // 6. Wait for navigation or timeout, then capture everything
    // Instead of a flat timeout, watch for URL change OR 5 seconds
    try {
      await page.waitForURL(/\/(dashboard|settings)/, { timeout: 5_000 });
      console.log("\n=== Navigation succeeded! ===");
      console.log("URL:", page.url());
    } catch {
      console.log("\n=== Navigation did NOT happen within 5s ===");
      console.log("URL:", page.url());
    }

    // Wait a moment for any remaining async responses
    await page.waitForTimeout(2000);

    // Dump cookies after OTP attempt
    const cookiesAfter = await page.context().cookies();
    console.log(
      "\nCookies after OTP:",
      cookiesAfter.map((c) => `${c.name}=${c.value.substring(0, 20)}...`).join(", ") || "none",
    );

    // 7. Dump ALL captured requests
    console.log(`\n=== ALL CAPTURED REQUESTS (${allRequests.length}) ===`);
    for (const req of allRequests) {
      console.log(`\n  [${req.timing}ms] ${req.method} ${req.url}`);
      console.log(`    Status: ${req.status}`);
      console.log(`    Body: ${req.body.substring(0, 300)}`);
      if (req.setCookie) console.log(`    Set-Cookie: ${req.setCookie.substring(0, 200)}`);
      if (req.requestCookie)
        console.log(`    Request Cookie: ${req.requestCookie.substring(0, 200)}`);
    }

    // 8. Check for toasts
    const toasts = page.locator("[data-sonner-toast]");
    const toastCount = await toasts.count();
    if (toastCount > 0) {
      console.log(`\n=== TOASTS (${toastCount}) ===`);
      for (let i = 0; i < toastCount; i++) {
        const text = await toasts.nth(i).textContent();
        console.log(`  Toast ${i}: ${text}`);
      }
    }

    // 9. Dump console logs (filter to relevant ones)
    const relevantLogs = consoleLogs.filter(
      (l) =>
        l.type === "error" ||
        l.type === "warning" ||
        l.text.includes("navigate") ||
        l.text.includes("redirect") ||
        l.text.includes("auth") ||
        l.text.includes("session") ||
        l.text.includes("beforeLoad"),
    );
    if (relevantLogs.length > 0) {
      console.log(`\n=== RELEVANT CONSOLE LOGS (${relevantLogs.length}) ===`);
      for (const log of relevantLogs) {
        console.log(`  [${log.timing}ms] ${log.type}: ${log.text.substring(0, 300)}`);
      }
    }

    if (pageErrors.length > 0) {
      console.log("\n=== PAGE ERRORS ===");
      for (const err of pageErrors) {
        console.log(`  ${err}`);
      }
    }

    // 10. Take final screenshot
    await page.screenshot({ path: "test-results/debug-otp-final-state.png" });
    console.log("\nFinal screenshot: test-results/debug-otp-final-state.png");
    console.log("Current URL:", page.url());

    // 11. Check outcome
    const currentUrl = page.url();
    if (currentUrl.includes("dashboard")) {
      console.log("\n=== RESULT: Redirected to dashboard (success) ===");
    } else if (currentUrl.includes("settings")) {
      console.log("\n=== RESULT: Redirected to settings (first-time setup) ===");
    } else {
      console.log("\n=== RESULT: Still on sign-in page (the bug!) ===");

      // Test manual navigation via evaluate to check if router works
      console.log("\nTesting manual window.location navigation...");
      const manualNavResult = await page.evaluate(() => {
        try {
          // Check if TanStack Router is accessible
          const routerState = (window as any).__TSR__?.router?.state;
          return {
            routerLocation: routerState?.location?.pathname ?? "unknown",
            routerPending: routerState?.isTransitioning ?? "unknown",
          };
        } catch (e) {
          return { error: (e as Error).message };
        }
      });
      console.log("Router state:", JSON.stringify(manualNavResult));

      // Now test the refresh behavior
      console.log("\nRefreshing page...");
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      console.log("URL after refresh:", page.url());

      if (page.url().includes("dashboard") || page.url().includes("settings")) {
        console.log("\n=== CONFIRMED: Session exists but client-side navigation failed ===");
        console.log(
          'The OTP verification succeeded server-side but navigate("/dashboard") did not work.',
        );
        console.log(
          "Likely cause: _authenticated beforeLoad redirect back to sign-in due to stale query cache.",
        );
      }
    }
  });
});
