// tests/unit/services/nhl-salary-api.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env/server", () => ({
  env: {
    NHL_SALARY_API_URL: "https://test-api.example.com",
    NHL_SALARY_API_KEY: "test-key-123",
  },
}));

const { fetchPlayers, fetchPlayerById, fetchInjuries, triggerPlayerScrape, triggerInjuryScrape } =
  await import("@/server/services/nhl-salary-api");

describe("nhl-salary-api", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchPlayers calls GET /players with bearer auth", async () => {
    await fetchPlayers();
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/players",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key-123",
        }),
      }),
    );
  });

  it("fetchPlayerById calls GET /players/{nhlId}", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          nhlId: 8478402,
          name: "Connor McDavid",
          team: "EDM",
          position: "C",
          salary: 12500000,
          injury: null,
        }),
    } as Response);
    const player = await fetchPlayerById(8478402);
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/players/8478402",
      expect.any(Object),
    );
    expect(player.name).toBe("Connor McDavid");
  });

  it("fetchInjuries calls GET /injuries", async () => {
    await fetchInjuries();
    expect(fetch).toHaveBeenCalledWith("https://test-api.example.com/injuries", expect.any(Object));
  });

  it("triggerPlayerScrape calls POST /admin/scrape/players", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Scrape initiated" }),
    } as Response);
    await triggerPlayerScrape();
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/admin/scrape/players",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("triggerInjuryScrape calls POST /admin/scrape/injuries", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Scrape initiated" }),
    } as Response);
    await triggerInjuryScrape();
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/admin/scrape/injuries",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);
    await expect(fetchPlayers()).rejects.toThrow();
  });
});
