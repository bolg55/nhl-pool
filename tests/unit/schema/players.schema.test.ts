import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { players, games, goalEvents, goaltenderGameStats } from "@/server/db/schema/players.schema";

describe("players schema", () => {
  it("exports players table with correct name", () => {
    expect(getTableName(players)).toBe("players");
  });

  it("exports games table with correct name", () => {
    expect(getTableName(games)).toBe("games");
  });

  it("exports goalEvents table with correct name", () => {
    expect(getTableName(goalEvents)).toBe("goal_events");
  });

  it("exports goaltenderGameStats table with correct name", () => {
    expect(getTableName(goaltenderGameStats)).toBe("goaltender_game_stats");
  });
});
