import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { rosters, rosterSlots, rosterSnapshots } from "@/server/db/schema/roster.schema";

describe("roster.schema", () => {
  it('rosters table name is "rosters"', () => {
    expect(getTableName(rosters)).toBe("rosters");
  });

  it('rosterSlots table name is "roster_slots"', () => {
    expect(getTableName(rosterSlots)).toBe("roster_slots");
  });

  it('rosterSnapshots table name is "roster_snapshots"', () => {
    expect(getTableName(rosterSnapshots)).toBe("roster_snapshots");
  });
});
