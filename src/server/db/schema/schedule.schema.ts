import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  date,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";

import { organization } from "./auth.schema";

export const weeklySchedules = pgTable(
  "weekly_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    lockTime: timestamp("lock_time", { withTimezone: true }).notNull(),
    isOverridden: boolean("is_overridden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("weekly_schedules_pool_week_unique").on(table.poolId, table.weekNumber),
    index("weekly_schedules_pool_week_idx").on(table.poolId, table.weekNumber),
    index("weekly_schedules_pool_dates_idx").on(table.poolId, table.startDate, table.endDate),
  ],
);

export const weeklySchedulesRelations = relations(weeklySchedules, ({ one }) => ({
  pool: one(organization, { fields: [weeklySchedules.poolId], references: [organization.id] }),
}));
