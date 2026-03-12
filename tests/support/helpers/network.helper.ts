import type { Page, Route } from "@playwright/test";

/**
 * Network interception utilities for E2E tests.
 *
 * Provides route mocking helpers and response factories
 * following the network-first pattern (intercept BEFORE navigate).
 */

export interface MockResponseOptions {
  status?: number;
  contentType?: string;
  headers?: Record<string, string>;
  delay?: number;
}

/**
 * Create a JSON response body for route.fulfill().
 */
export function jsonResponse<T>(data: T, options: MockResponseOptions = {}) {
  return {
    status: options.status ?? 200,
    contentType: options.contentType ?? "application/json",
    headers: options.headers,
    body: JSON.stringify(data),
  };
}

/**
 * Create an error response for route.fulfill().
 */
export function errorResponse(
  status: number,
  message: string,
  options: Omit<MockResponseOptions, "status"> = {},
) {
  return jsonResponse({ error: message }, { ...options, status });
}

/**
 * Mock a GET endpoint with a JSON response.
 * Registers the route BEFORE any navigation (network-first pattern).
 */
export async function mockGetRoute<T>(
  page: Page,
  urlPattern: string,
  data: T,
  options: MockResponseOptions = {},
) {
  await page.route(urlPattern, async (route) => {
    if (route.request().method() !== "GET") {
      return route.continue();
    }
    if (options.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }
    return route.fulfill(jsonResponse(data, options));
  });
}

/**
 * Mock a POST endpoint with a JSON response.
 */
export async function mockPostRoute<T>(
  page: Page,
  urlPattern: string,
  data: T,
  options: MockResponseOptions = {},
) {
  await page.route(urlPattern, async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    if (options.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }
    return route.fulfill(jsonResponse(data, { status: 201, ...options }));
  });
}

/**
 * Mock an endpoint to return an error.
 */
export async function mockErrorRoute(
  page: Page,
  urlPattern: string,
  status: number,
  message: string,
  options: Omit<MockResponseOptions, "status"> = {},
) {
  await page.route(urlPattern, async (route) => {
    if (options.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }
    return route.fulfill(errorResponse(status, message, options));
  });
}

/**
 * Mock an endpoint that never responds (simulates timeout).
 */
export async function mockTimeoutRoute(page: Page, urlPattern: string) {
  await page.route(urlPattern, () => {
    // Intentionally never fulfill or continue — simulates a network timeout.
  });
}

/**
 * Intercept a request and capture its body for assertion.
 * Returns a promise that resolves with the parsed request body.
 */
export function captureRequestBody<T = unknown>(
  page: Page,
  urlPattern: string,
  method = "POST",
): Promise<T> {
  return new Promise<T>((resolve) => {
    page.route(urlPattern, async (route) => {
      if (route.request().method() === method) {
        const body = route.request().postDataJSON() as T;
        resolve(body);
      }
      await route.continue();
    });
  });
}

/**
 * Set up a conditional route handler that returns different responses
 * based on request properties (method, query params, body).
 */
export async function mockConditionalRoute(
  page: Page,
  urlPattern: string,
  handler: (route: Route) => Promise<void> | void,
) {
  await page.route(urlPattern, handler);
}

/**
 * Wait for a specific network response matching URL and status.
 * Register BEFORE triggering the action (network-first pattern).
 */
export function waitForApiResponse(page: Page, urlPattern: string, expectedStatus = 200) {
  return page.waitForResponse(
    (resp) => resp.url().includes(urlPattern) && resp.status() === expectedStatus,
  );
}
