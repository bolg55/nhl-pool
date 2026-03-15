import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { financialLedger } from "@/server/db/schema/financial.schema";

describe("financial.schema", () => {
  it('financialLedger table name is "financial_ledger"', () => {
    expect(getTableName(financialLedger)).toBe("financial_ledger");
  });
});
