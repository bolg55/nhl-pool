import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, uuid, index } from "drizzle-orm/pg-core";

import { organization, user } from "./auth.schema";
import { weeklySchedules } from "./schedule.schema";

export const financialLedger = pgTable(
  "financial_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekId: uuid("week_id").references(() => weeklySchedules.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    amount: integer("amount").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("financial_ledger_pool_user_idx").on(table.poolId, table.userId)],
);

export const financialLedgerRelations = relations(financialLedger, ({ one }) => ({
  pool: one(organization, { fields: [financialLedger.poolId], references: [organization.id] }),
  user: one(user, { fields: [financialLedger.userId], references: [user.id] }),
  week: one(weeklySchedules, {
    fields: [financialLedger.weekId],
    references: [weeklySchedules.id],
  }),
}));
