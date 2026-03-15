import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { poolConfig, scoringEvents, weeklyScores } from "@/server/db/schema/scoring.schema";

describe("scoring.schema", () => {
  it('poolConfig table name is "pool_config"', () => {
    expect(getTableName(poolConfig)).toBe("pool_config");
  });

  it('scoringEvents table name is "scoring_events"', () => {
    expect(getTableName(scoringEvents)).toBe("scoring_events");
  });

  it('weeklyScores table name is "weekly_scores"', () => {
    expect(getTableName(weeklyScores)).toBe("weekly_scores");
  });
});
