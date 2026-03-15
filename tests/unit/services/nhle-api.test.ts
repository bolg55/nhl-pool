// tests/unit/services/nhle-api.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchScores, fetchSchedule, fetchPlayerGameLog } from "@/server/services/nhle-api";

describe("nhle-api", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchScores calls /v1/score/now", async () => {
    await fetchScores();
    expect(fetch).toHaveBeenCalledWith("https://api-web.nhle.com/v1/score/now", expect.any(Object));
  });

  it("fetchSchedule calls /v1/schedule/{date}", async () => {
    await fetchSchedule("2026-03-15");
    expect(fetch).toHaveBeenCalledWith(
      "https://api-web.nhle.com/v1/schedule/2026-03-15",
      expect.any(Object),
    );
  });

  it("fetchPlayerGameLog calls /v1/player/{id}/game-log/now", async () => {
    await fetchPlayerGameLog(8478402);
    expect(fetch).toHaveBeenCalledWith(
      "https://api-web.nhle.com/v1/player/8478402/game-log/now",
      expect.any(Object),
    );
  });

  it("throws on non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);
    await expect(fetchScores()).rejects.toThrow();
  });
});
