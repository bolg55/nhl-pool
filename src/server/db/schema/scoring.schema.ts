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

export const poolConfig = pgTable("pool_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  poolId: text("pool_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  salaryCap: integer("salary_cap"),
  captainMode: boolean("captain_mode").notNull().default(false),
  goaltendingMode: text("goaltending_mode").notNull().default("team"),
  rosterConstraints: jsonb("roster_constraints")
    .notNull()
    .default({ forwards: 6, defensemen: 4, goalies: 2 }),
  scoringRules: jsonb("scoring_rules")
    .notNull()
    .default({
      forward: { goal: 2, assist: 1, hatTrick: 2 },
      defenseman: { goal: 2, assist: 1, hatTrick: 2 },
      goalie: { goal: 2, assist: 1 },
      goaltending: { win: 2, shutout: 2, overtimeLoss: 1 },
    }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const scoringEvents = pgTable(
  "scoring_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    weekId: uuid("week_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    playerNhlId: integer("player_nhl_id").notNull(),
    nhlGameId: integer("nhl_game_id").notNull(),
    eventType: text("event_type").notNull(),
    points: integer("points").notNull(),
    basePoints: integer("base_points").notNull(),
    isCaptainBonus: boolean("is_captain_bonus").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scoring_events_pool_week_user_idx").on(table.poolId, table.weekId, table.userId),
    index("scoring_events_nhl_game_id_idx").on(table.nhlGameId),
  ],
);

export const weeklyScores = pgTable(
  "weekly_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    weekId: uuid("week_id")
      .notNull()
      .references(() => weeklySchedules.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    totalPoints: integer("total_points").notNull().default(0),
    isWinner: boolean("is_winner").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("weekly_scores_pool_week_user_unique").on(table.poolId, table.weekId, table.userId),
    index("weekly_scores_pool_week_idx").on(table.poolId, table.weekId),
  ],
);

export const poolConfigRelations = relations(poolConfig, ({ one }) => ({
  pool: one(organization, { fields: [poolConfig.poolId], references: [organization.id] }),
}));

export const scoringEventsRelations = relations(scoringEvents, ({ one }) => ({
  pool: one(organization, { fields: [scoringEvents.poolId], references: [organization.id] }),
  week: one(weeklySchedules, { fields: [scoringEvents.weekId], references: [weeklySchedules.id] }),
  user: one(user, { fields: [scoringEvents.userId], references: [user.id] }),
}));

export const weeklyScoresRelations = relations(weeklyScores, ({ one }) => ({
  pool: one(organization, { fields: [weeklyScores.poolId], references: [organization.id] }),
  week: one(weeklySchedules, { fields: [weeklyScores.weekId], references: [weeklySchedules.id] }),
  user: one(user, { fields: [weeklyScores.userId], references: [user.id] }),
}));
