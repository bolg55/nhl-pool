import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { weeklySchedules } from "@/server/db/schema/schedule.schema";

describe("schedule.schema", () => {
  it('weeklySchedules table name is "weekly_schedules"', () => {
    expect(getTableName(weeklySchedules)).toBe("weekly_schedules");
  });
});
