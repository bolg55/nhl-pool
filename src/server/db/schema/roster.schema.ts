import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  boolean,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth.schema";
import { weeklySchedules } from "./schedule.schema";

export const rosters = pgTable(
  "rosters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekId: uuid("week_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("rosters_pool_user_week_unique").on(table.poolId, table.userId, table.weekId),
    index("rosters_pool_user_week_idx").on(table.poolId, table.userId, table.weekId),
  ],
);

export const rosterSlots = pgTable(
  "roster_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => rosters.id, { onDelete: "cascade" }),
    playerNhlId: integer("player_nhl_id").notNull(),
    position: text("position").notNull(),
    isCaptain: boolean("is_captain").notNull().default(false),
    salary: integer("salary").notNull(),
  },
  (table) => [index("roster_slots_roster_id_idx").on(table.rosterId)],
);

export const rosterSnapshots = pgTable(
  "roster_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekId: uuid("week_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    slots: jsonb("slots").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("roster_snapshots_pool_user_week_unique").on(table.poolId, table.userId, table.weekId),
  ],
);

// Relations
export const rostersRelations = relations(rosters, ({ one, many }) => ({
  pool: one(organization, { fields: [rosters.poolId], references: [organization.id] }),
  user: one(user, { fields: [rosters.userId], references: [user.id] }),
  week: one(weeklySchedules, { fields: [rosters.weekId], references: [weeklySchedules.id] }),
  slots: many(rosterSlots),
}));

export const rosterSlotsRelations = relations(rosterSlots, ({ one }) => ({
  roster: one(rosters, { fields: [rosterSlots.rosterId], references: [rosters.id] }),
}));

export const rosterSnapshotsRelations = relations(rosterSnapshots, ({ one }) => ({
  pool: one(organization, { fields: [rosterSnapshots.poolId], references: [organization.id] }),
  user: one(user, { fields: [rosterSnapshots.userId], references: [user.id] }),
  week: one(weeklySchedules, {
    fields: [rosterSnapshots.weekId],
    references: [weeklySchedules.id],
  }),
}));
