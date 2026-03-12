import type { APIRequestContext, APIResponse } from "@playwright/test";

/**
 * Typed API client helper wrapping Playwright's APIRequestContext.
 *
 * Provides convenience methods for common HTTP operations with
 * built-in error handling and response validation.
 */

export interface ApiClientOptions {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
  ok: boolean;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(
    private readonly request: APIRequestContext,
    options: ApiClientOptions = {},
  ) {
    this.baseUrl = options.baseUrl ?? "";
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...options.defaultHeaders,
    };
  }

  /**
   * Set the authorization header for subsequent requests.
   */
  withAuth(token: string): ApiClient {
    return new ApiClient(this.request, {
      baseUrl: this.baseUrl,
      defaultHeaders: {
        ...this.defaultHeaders,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async get<T = unknown>(
    path: string,
    options?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const response = await this.request.get(this.url(path), {
      headers: { ...this.defaultHeaders, ...options?.headers },
    });
    return this.parseResponse<T>(response);
  }

  async post<T = unknown>(
    path: string,
    data?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const response = await this.request.post(this.url(path), {
      data,
      headers: { ...this.defaultHeaders, ...options?.headers },
    });
    return this.parseResponse<T>(response);
  }

  async put<T = unknown>(
    path: string,
    data?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const response = await this.request.put(this.url(path), {
      data,
      headers: { ...this.defaultHeaders, ...options?.headers },
    });
    return this.parseResponse<T>(response);
  }

  async delete<T = unknown>(
    path: string,
    options?: { headers?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    const response = await this.request.delete(this.url(path), {
      headers: { ...this.defaultHeaders, ...options?.headers },
    });
    return this.parseResponse<T>(response);
  }

  /**
   * Assert that a response has the expected status code.
   * Throws a descriptive error if the status does not match.
   */
  assertStatus<T>(
    response: ApiResponse<T>,
    expectedStatus: number,
  ): asserts response is ApiResponse<T> & { ok: true } {
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status}. ` +
          `Response body: ${JSON.stringify(response.data)}`,
      );
    }
  }

  /**
   * Make a request and assert it returns the expected status.
   */
  async getOk<T = unknown>(path: string, expectedStatus = 200): Promise<ApiResponse<T>> {
    const response = await this.get<T>(path);
    this.assertStatus(response, expectedStatus);
    return response;
  }

  async postOk<T = unknown>(
    path: string,
    data?: unknown,
    expectedStatus = 201,
  ): Promise<ApiResponse<T>> {
    const response = await this.post<T>(path, data);
    this.assertStatus(response, expectedStatus);
    return response;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async parseResponse<T>(response: APIResponse): Promise<ApiResponse<T>> {
    let data: T;
    const contentType = response.headers()["content-type"] ?? "";

    if (contentType.includes("application/json")) {
      data = (await response.json()) as T;
    } else {
      data = (await response.text()) as unknown as T;
    }

    return {
      status: response.status(),
      data,
      headers: response.headers() as Record<string, string>,
      ok: response.ok(),
    };
  }
}

/**
 * Create an ApiClient instance from a Playwright APIRequestContext.
 */
export function createApiClient(request: APIRequestContext, options?: ApiClientOptions): ApiClient {
  return new ApiClient(request, options);
}
