import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  date,
  real,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ---------- players ----------
export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nhlId: integer("nhl_id").notNull().unique(),
    name: text("name").notNull(),
    team: text("team").notNull(),
    position: text("position").notNull(),
    salary: integer("salary"),
    injuryStatus: text("injury_status"),
    injuryDescription: text("injury_description"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("players_team_idx").on(table.team),
    index("players_position_idx").on(table.position),
  ],
);

// ---------- games ----------
export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nhlGameId: integer("nhl_game_id").notNull().unique(),
    season: text("season").notNull(),
    gameDate: date("game_date").notNull(),
    gameType: integer("game_type").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    gameState: text("game_state").notNull(),
    startTimeUtc: timestamp("start_time_utc", { withTimezone: true }).notNull(),
    period: integer("period"),
    timeRemaining: text("time_remaining"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("games_game_date_idx").on(table.gameDate),
    index("games_home_team_idx").on(table.homeTeam),
    index("games_away_team_idx").on(table.awayTeam),
  ],
);

// ---------- goalEvents ----------
export const goalEvents = pgTable(
  "goal_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    nhlGameId: integer("nhl_game_id").notNull(),
    scorerNhlId: integer("scorer_nhl_id").notNull(),
    period: integer("period").notNull(),
    timeInPeriod: text("time_in_period").notNull(),
    strength: text("strength").notNull(),
    goalModifier: text("goal_modifier"),
    assistNhlIds: integer("assist_nhl_ids").array().notNull().default([]),
    homeScore: integer("home_score").notNull(),
    awayScore: integer("away_score").notNull(),
  },
  (table) => [
    unique("goal_events_unique").on(
      table.nhlGameId,
      table.scorerNhlId,
      table.period,
      table.timeInPeriod,
      table.homeScore,
      table.awayScore,
    ),
    index("goal_events_game_id_idx").on(table.gameId),
    index("goal_events_scorer_nhl_id_idx").on(table.scorerNhlId),
    index("goal_events_nhl_game_id_idx").on(table.nhlGameId),
  ],
);

// ---------- goaltenderGameStats ----------
export const goaltenderGameStats = pgTable(
  "goaltender_game_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    nhlGameId: integer("nhl_game_id").notNull(),
    goaltenderNhlId: integer("goaltender_nhl_id").notNull(),
    decision: text("decision"),
    shotsAgainst: integer("shots_against").notNull(),
    goalsAgainst: integer("goals_against").notNull(),
    savePctg: real("save_pctg").notNull(),
    shutout: boolean("shutout").notNull().default(false),
    toi: text("toi").notNull(),
  },
  (table) => [
    unique("goaltender_game_stats_unique").on(table.nhlGameId, table.goaltenderNhlId),
    index("goaltender_game_stats_game_id_idx").on(table.gameId),
    index("goaltender_game_stats_goaltender_nhl_id_idx").on(table.goaltenderNhlId),
    index("goaltender_game_stats_nhl_game_id_idx").on(table.nhlGameId),
  ],
);

// ---------- Relations ----------
export const gamesRelations = relations(games, ({ many }) => ({
  goalEvents: many(goalEvents),
  goaltenderGameStats: many(goaltenderGameStats),
}));

export const goalEventsRelations = relations(goalEvents, ({ one }) => ({
  game: one(games, {
    fields: [goalEvents.gameId],
    references: [games.id],
  }),
}));

export const goaltenderGameStatsRelations = relations(goaltenderGameStats, ({ one }) => ({
  game: one(games, {
    fields: [goaltenderGameStats.gameId],
    references: [games.id],
  }),
}));
