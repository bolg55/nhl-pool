// tests/unit/services/data-sync.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/nhl-salary-api", () => ({
  fetchPlayers: vi.fn(),
  triggerPlayerScrape: vi.fn(),
  triggerInjuryScrape: vi.fn(),
}));

vi.mock("@/server/services/nhle-api", () => ({
  fetchSchedule: vi.fn(),
  fetchScores: vi.fn(),
  fetchPlayerGameLog: vi.fn(),
}));

const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/server/db", () => {
  // Create a thenable query result that also has .limit() / .orderBy()
  function makeThenableQuery(resolveWith: unknown[] = []) {
    const result = {
      limit: (...lArgs: unknown[]) => {
        mockLimit(...lArgs);
        return Promise.resolve(resolveWith);
      },
      orderBy: (...oArgs: unknown[]) => {
        mockOrderBy(...oArgs);
        return Promise.resolve(resolveWith);
      },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        return Promise.resolve(resolveWith).then(resolve, reject);
      },
    };
    return result;
  }

  const mockDb = {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            onConflictDoUpdate: (...cuArgs: unknown[]) => {
              mockOnConflictDoUpdate(...cuArgs);
              return Promise.resolve();
            },
            onConflictDoNothing: (...cnArgs: unknown[]) => {
              mockOnConflictDoNothing(...cnArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              const resolved = mockWhere(...wArgs);
              // If mockWhere was set to return a specific value, use it
              if (Array.isArray(resolved)) {
                return makeThenableQuery(resolved);
              }
              return makeThenableQuery([]);
            },
            orderBy: (...oArgs: unknown[]) => {
              mockOrderBy(...oArgs);
              return Promise.resolve([]);
            },
            limit: (...lArgs: unknown[]) => {
              mockLimit(...lArgs);
              return Promise.resolve([]);
            },
          };
        },
      };
    },
  };
  return { db: mockDb };
});

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => {
  // sql is a tagged template literal function
  const sqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  });
  return {
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    ne: vi.fn((a: unknown, b: unknown) => [a, b]),
    sql: sqlFn,
  };
});

// Mock schema modules to avoid import issues
vi.mock("@/server/db/schema/players.schema", () => ({
  players: { nhlId: "nhlId" },
  games: { id: "id", nhlGameId: "nhlGameId", gameDate: "gameDate", gameState: "gameState" },
  goalEvents: {},
  goaltenderGameStats: { nhlGameId: "nhlGameId", goaltenderNhlId: "goaltenderNhlId" },
}));

vi.mock("@/server/db/schema/schedule.schema", () => ({
  weeklySchedules: { poolId: "poolId", weekNumber: "weekNumber", isOverridden: "isOverridden" },
}));

vi.mock("@/server/db/schema/auth.schema", () => ({
  organization: {},
}));

const { fetchPlayers } = await import("@/server/services/nhl-salary-api");
const { triggerPlayerScrape } = await import("@/server/services/nhl-salary-api");
const { triggerInjuryScrape } = await import("@/server/services/nhl-salary-api");
const { fetchScores } = await import("@/server/services/nhle-api");

const { syncPlayers, syncInjuries, syncLiveScoring, _isWithinGameWindow } =
  await import("@/server/services/data-sync");

describe("data-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("syncPlayers", () => {
    it("calls fetchPlayers and returns count", async () => {
      vi.mocked(fetchPlayers).mockResolvedValue([
        { nhlId: 1, name: "Player One", team: "TOR", position: "C", salary: 5000000, injury: null },
        { nhlId: 2, name: "Player Two", team: "MTL", position: "D", salary: 3000000, injury: null },
      ]);

      const result = await syncPlayers();

      expect(fetchPlayers).toHaveBeenCalledOnce();
      expect(result.count).toBe(2);
      expect(result.syncedAt).toBeInstanceOf(Date);
    });

    it("triggers upstream scrape when triggerScrape=true", async () => {
      vi.mocked(fetchPlayers).mockResolvedValue([]);
      vi.mocked(triggerPlayerScrape).mockResolvedValue({ message: "ok" });

      await syncPlayers({ triggerScrape: true });

      expect(triggerPlayerScrape).toHaveBeenCalledOnce();
    });

    it("does NOT trigger scrape by default", async () => {
      vi.mocked(fetchPlayers).mockResolvedValue([]);

      await syncPlayers();

      expect(triggerPlayerScrape).not.toHaveBeenCalled();
    });

    it("maps injury data to injuryStatus and injuryDescription", async () => {
      vi.mocked(fetchPlayers).mockResolvedValue([
        {
          nhlId: 1,
          name: "Injured Guy",
          team: "TOR",
          position: "C",
          salary: 5000000,
          injury: { status: "Day-to-Day", description: "Lower body" },
        },
      ]);

      await syncPlayers();

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          injuryStatus: "Day-to-Day",
          injuryDescription: "Lower body",
        }),
      );
    });
  });

  describe("syncInjuries", () => {
    it("triggers injury scrape then syncs players", async () => {
      vi.mocked(triggerInjuryScrape).mockResolvedValue({ message: "ok" });
      vi.mocked(fetchPlayers).mockResolvedValue([]);

      await syncInjuries();

      expect(triggerInjuryScrape).toHaveBeenCalledOnce();
      expect(fetchPlayers).toHaveBeenCalledOnce();
    });
  });

  describe("_isWithinGameWindow", () => {
    it("returns true during game hours (UTC 20:00 = 4pm ET)", () => {
      const gameTime = new Date("2026-01-15T20:00:00Z");
      expect(_isWithinGameWindow(gameTime)).toBe(true);
    });

    it("returns true at UTC 15:00 (boundary start)", () => {
      const gameTime = new Date("2026-01-15T15:00:00Z");
      expect(_isWithinGameWindow(gameTime)).toBe(true);
    });

    it("returns true at UTC 03:00 (late night)", () => {
      const lateNight = new Date("2026-01-15T03:00:00Z");
      expect(_isWithinGameWindow(lateNight)).toBe(true);
    });

    it("returns false at UTC 08:00 (4am ET outside window)", () => {
      const morning = new Date("2026-01-15T08:00:00Z");
      expect(_isWithinGameWindow(morning)).toBe(false);
    });

    it("returns false at UTC 10:00 (morning)", () => {
      const morning = new Date("2026-01-15T10:00:00Z");
      expect(_isWithinGameWindow(morning)).toBe(false);
    });
  });

  describe("syncLiveScoring", () => {
    it("short-circuits outside game window", async () => {
      const morning = new Date("2026-01-15T10:00:00Z");

      const result = await syncLiveScoring(morning);

      expect(result.skipped).toBe(true);
      expect(result.gamesUpdated).toBe(0);
      expect(fetchScores).not.toHaveBeenCalled();
    });

    it("short-circuits when all games are FINAL", async () => {
      const gameTime = new Date("2026-01-15T20:00:00Z");

      // Mock: db query returns all-final games
      mockWhere.mockReturnValueOnce([{ gameState: "FINAL" }, { gameState: "FINAL" }]);

      const result = await syncLiveScoring(gameTime);

      expect(result.skipped).toBe(true);
      expect(fetchScores).not.toHaveBeenCalled();
    });

    it("fetches scores when within game window and games are live", async () => {
      const gameTime = new Date("2026-01-15T20:00:00Z");

      // Mock: db query returns live games (not all final)
      mockWhere.mockReturnValueOnce([{ gameState: "LIVE" }]);

      vi.mocked(fetchScores).mockResolvedValue({
        games: [],
        currentDate: "2026-01-15",
        prevDate: "2026-01-14",
        nextDate: "2026-01-16",
      });

      const result = await syncLiveScoring(gameTime);

      expect(result.skipped).toBe(false);
      expect(fetchScores).toHaveBeenCalledOnce();
    });
  });
});
