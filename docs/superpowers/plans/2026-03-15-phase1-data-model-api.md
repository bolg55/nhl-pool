# Phase 1: Data Model & External APIs — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data foundation (Drizzle schema, NHL API wrappers, data sync orchestration) that all subsequent phases read from.

**Architecture:** Domain-grouped Drizzle schema files synced from two NHL APIs via a data-sync orchestration layer. DB-as-cache pattern — the app reads only from Postgres, never from APIs during user requests. Server functions expose read-only access and admin sync triggers.

**Tech Stack:** Drizzle ORM 0.45.1, PostgreSQL, Zod 4, TanStack Start server functions, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-phase1-data-model-api-design.md`

---

## File Structure

### Schema files (new)

- `src/server/db/schema/players.schema.ts` — `players`, `games`, `goalEvents`, `goaltenderGameStats` tables + relations
- `src/server/db/schema/schedule.schema.ts` — `weeklySchedules` table + relations
- `src/server/db/schema/roster.schema.ts` — `rosters`, `rosterSlots`, `rosterSnapshots` tables + relations
- `src/server/db/schema/scoring.schema.ts` — `poolConfig`, `scoringEvents`, `weeklyScores` tables + relations
- `src/server/db/schema/financial.schema.ts` — `financialLedger` table + relations

### Schema files (modify)

- `src/server/db/schema/index.ts` — re-export all new schema files

### Service files (new)

- `src/server/services/nhl-salary-api.ts` — typed wrapper for NHL Salary API
- `src/server/services/nhle-api.ts` — typed wrapper for NHL-e public API
- `src/server/services/data-sync.ts` — sync orchestration (syncPlayers, syncSchedule, syncLiveScoring, syncInjuries, nightly reconciliation)

### Server function files (new/modify)

- `src/server/functions/admin.ts` — `$syncPlayers`, `$syncInjuries`, `$getSyncStatus`
- `src/server/functions/pool.ts` — add `$getPoolConfig`, `$getWeeklySchedule`

### Environment (modify)

- `src/env/server.ts` — add `NHL_SALARY_API_URL`, `NHL_SALARY_API_KEY`

### Test files (new)

- `tests/unit/schema/players.schema.test.ts` — schema smoke tests
- `tests/unit/schema/schedule.schema.test.ts`
- `tests/unit/schema/roster.schema.test.ts`
- `tests/unit/schema/scoring.schema.test.ts`
- `tests/unit/schema/financial.schema.test.ts`
- `tests/unit/services/nhl-salary-api.test.ts` — API wrapper tests with mocked fetch
- `tests/unit/services/nhle-api.test.ts`
- `tests/unit/services/data-sync.test.ts` — sync orchestration tests

### Config (new/modify)

- `vitest.config.ts` — unit test config (project has pact config but no unit test config yet)

---

## Chunk 1: Environment & Test Infrastructure

### Task 1: Vitest Unit Test Configuration

**Files:**

- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest config for unit tests**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 10000,
  },
});
```

Note: Using `resolve.alias` instead of `vite-tsconfig-paths` for Vite 8 beta / Vitest 4 compatibility.

- [ ] **Step 2: Verify no additional dependencies needed**

The `@/` alias is configured directly in vitest config. No extra packages needed.

- [ ] **Step 3: Add test:unit script to package.json**

Add to `"scripts"`:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs (no tests yet, should exit cleanly)**

Run: `bun run test:unit`
Expected: "No test files found" or clean exit

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json bun.lockb
git commit -m "chore: add vitest unit test configuration"
```

---

### Task 2: Environment Configuration

**Files:**

- Modify: `src/env/server.ts`

- [ ] **Step 1: Add NHL Salary API env vars to server env config**

Add to the `server` object in `createEnv`:

```typescript
NHL_SALARY_API_URL: z.url(),
NHL_SALARY_API_KEY: z.string().min(1),
```

- [ ] **Step 2: Verify the app still starts**

Run: `bun run dev`
Expected: App starts without env validation errors (vars already in `.env.local`)

- [ ] **Step 3: Commit**

```bash
git add src/env/server.ts
git commit -m "feat: add NHL Salary API env vars"
```

---

## Chunk 2: Drizzle Schema — Players & NHL Data

### Task 3: Players Schema

**Files:**

- Create: `src/server/db/schema/players.schema.ts`
- Modify: `src/server/db/schema/index.ts`
- Create: `tests/unit/schema/players.schema.test.ts`

- [ ] **Step 1: Write schema smoke test**

```typescript
// tests/unit/schema/players.schema.test.ts
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/schema/players.schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create players schema file**

```typescript
// src/server/db/schema/players.schema.ts
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
```

- [ ] **Step 4: Add export to schema index**

Update `src/server/db/schema/index.ts`:

```typescript
export * from "./auth.schema";
export * from "./players.schema";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit tests/unit/schema/players.schema.test.ts`
Expected: PASS — all 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/players.schema.ts src/server/db/schema/index.ts tests/unit/schema/players.schema.test.ts
git commit -m "feat: add players, games, goalEvents, goaltenderGameStats schema"
```

---

### Task 4: Schedule Schema

**Files:**

- Create: `src/server/db/schema/schedule.schema.ts`
- Modify: `src/server/db/schema/index.ts`
- Create: `tests/unit/schema/schedule.schema.test.ts`

- [ ] **Step 1: Write schema smoke test**

```typescript
// tests/unit/schema/schedule.schema.test.ts
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { weeklySchedules } from "@/server/db/schema/schedule.schema";

describe("schedule schema", () => {
  it("exports weeklySchedules table with correct name", () => {
    expect(getTableName(weeklySchedules)).toBe("weekly_schedules");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/schema/schedule.schema.test.ts`
Expected: FAIL

- [ ] **Step 3: Create schedule schema file**

```typescript
// src/server/db/schema/schedule.schema.ts
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
  pool: one(organization, {
    fields: [weeklySchedules.poolId],
    references: [organization.id],
  }),
}));
```

- [ ] **Step 4: Add export to schema index**

Add to `src/server/db/schema/index.ts`:

```typescript
export * from "./schedule.schema";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit tests/unit/schema/schedule.schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/schedule.schema.ts src/server/db/schema/index.ts tests/unit/schema/schedule.schema.test.ts
git commit -m "feat: add weeklySchedules schema"
```

---

### Task 5: Roster Schema

**Files:**

- Create: `src/server/db/schema/roster.schema.ts`
- Modify: `src/server/db/schema/index.ts`
- Create: `tests/unit/schema/roster.schema.test.ts`

- [ ] **Step 1: Write schema smoke test**

```typescript
// tests/unit/schema/roster.schema.test.ts
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { rosters, rosterSlots, rosterSnapshots } from "@/server/db/schema/roster.schema";

describe("roster schema", () => {
  it("exports rosters table", () => {
    expect(getTableName(rosters)).toBe("rosters");
  });

  it("exports rosterSlots table", () => {
    expect(getTableName(rosterSlots)).toBe("roster_slots");
  });

  it("exports rosterSnapshots table", () => {
    expect(getTableName(rosterSnapshots)).toBe("roster_snapshots");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/schema/roster.schema.test.ts`
Expected: FAIL

- [ ] **Step 3: Create roster schema file**

```typescript
// src/server/db/schema/roster.schema.ts
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

// ---------- rosters ----------
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

// ---------- rosterSlots ----------
export const rosterSlots = pgTable(
  "roster_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => rosters.id, { onDelete: "cascade" }),
    playerNhlId: integer("player_nhl_id").notNull(),
    position: text("position").notNull(), // "F", "D", "G"
    isCaptain: boolean("is_captain").notNull().default(false),
    salary: integer("salary").notNull(),
  },
  (table) => [index("roster_slots_roster_id_idx").on(table.rosterId)],
);

// ---------- rosterSnapshots ----------
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
    slots: jsonb("slots").notNull(), // frozen array of { playerNhlId, position, isCaptain, salary }
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("roster_snapshots_pool_user_week_unique").on(table.poolId, table.userId, table.weekId),
  ],
);

// ---------- Relations ----------
export const rostersRelations = relations(rosters, ({ one, many }) => ({
  pool: one(organization, {
    fields: [rosters.poolId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [rosters.userId],
    references: [user.id],
  }),
  week: one(weeklySchedules, {
    fields: [rosters.weekId],
    references: [weeklySchedules.id],
  }),
  slots: many(rosterSlots),
}));

export const rosterSlotsRelations = relations(rosterSlots, ({ one }) => ({
  roster: one(rosters, {
    fields: [rosterSlots.rosterId],
    references: [rosters.id],
  }),
}));

export const rosterSnapshotsRelations = relations(rosterSnapshots, ({ one }) => ({
  pool: one(organization, {
    fields: [rosterSnapshots.poolId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [rosterSnapshots.userId],
    references: [user.id],
  }),
  week: one(weeklySchedules, {
    fields: [rosterSnapshots.weekId],
    references: [weeklySchedules.id],
  }),
}));
```

- [ ] **Step 4: Add export to schema index**

Add to `src/server/db/schema/index.ts`:

```typescript
export * from "./roster.schema";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit tests/unit/schema/roster.schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/roster.schema.ts src/server/db/schema/index.ts tests/unit/schema/roster.schema.test.ts
git commit -m "feat: add rosters, rosterSlots, rosterSnapshots schema"
```

---

### Task 6: Scoring Schema (poolConfig, scoringEvents, weeklyScores)

**Files:**

- Create: `src/server/db/schema/scoring.schema.ts`
- Modify: `src/server/db/schema/index.ts`
- Create: `tests/unit/schema/scoring.schema.test.ts`

- [ ] **Step 1: Write schema smoke test**

```typescript
// tests/unit/schema/scoring.schema.test.ts
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { poolConfig, scoringEvents, weeklyScores } from "@/server/db/schema/scoring.schema";

describe("scoring schema", () => {
  it("exports poolConfig table", () => {
    expect(getTableName(poolConfig)).toBe("pool_config");
  });

  it("exports scoringEvents table", () => {
    expect(getTableName(scoringEvents)).toBe("scoring_events");
  });

  it("exports weeklyScores table", () => {
    expect(getTableName(weeklyScores)).toBe("weekly_scores");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/schema/scoring.schema.test.ts`
Expected: FAIL

- [ ] **Step 3: Create scoring schema file**

```typescript
// src/server/db/schema/scoring.schema.ts
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

// ---------- poolConfig ----------
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

// ---------- scoringEvents ----------
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

// ---------- weeklyScores ----------
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

// ---------- Relations ----------
export const poolConfigRelations = relations(poolConfig, ({ one }) => ({
  pool: one(organization, {
    fields: [poolConfig.poolId],
    references: [organization.id],
  }),
}));

export const scoringEventsRelations = relations(scoringEvents, ({ one }) => ({
  pool: one(organization, {
    fields: [scoringEvents.poolId],
    references: [organization.id],
  }),
  week: one(weeklySchedules, {
    fields: [scoringEvents.weekId],
    references: [weeklySchedules.id],
  }),
  user: one(user, {
    fields: [scoringEvents.userId],
    references: [user.id],
  }),
}));

export const weeklyScoresRelations = relations(weeklyScores, ({ one }) => ({
  pool: one(organization, {
    fields: [weeklyScores.poolId],
    references: [organization.id],
  }),
  week: one(weeklySchedules, {
    fields: [weeklyScores.weekId],
    references: [weeklySchedules.id],
  }),
  user: one(user, {
    fields: [weeklyScores.userId],
    references: [user.id],
  }),
}));
```

- [ ] **Step 4: Add export to schema index**

Add to `src/server/db/schema/index.ts`:

```typescript
export * from "./scoring.schema";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit tests/unit/schema/scoring.schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/scoring.schema.ts src/server/db/schema/index.ts tests/unit/schema/scoring.schema.test.ts
git commit -m "feat: add poolConfig, scoringEvents, weeklyScores schema"
```

---

### Task 7: Financial Schema

**Files:**

- Create: `src/server/db/schema/financial.schema.ts`
- Modify: `src/server/db/schema/index.ts`
- Create: `tests/unit/schema/financial.schema.test.ts`

- [ ] **Step 1: Write schema smoke test**

```typescript
// tests/unit/schema/financial.schema.test.ts
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { financialLedger } from "@/server/db/schema/financial.schema";

describe("financial schema", () => {
  it("exports financialLedger table", () => {
    expect(getTableName(financialLedger)).toBe("financial_ledger");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/schema/financial.schema.test.ts`
Expected: FAIL

- [ ] **Step 3: Create financial schema file**

```typescript
// src/server/db/schema/financial.schema.ts
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
    weekId: uuid("week_id").references(() => weeklySchedules.id, {
      onDelete: "cascade",
    }),
    eventType: text("event_type").notNull(),
    amount: integer("amount").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("financial_ledger_pool_user_idx").on(table.poolId, table.userId)],
);

export const financialLedgerRelations = relations(financialLedger, ({ one }) => ({
  pool: one(organization, {
    fields: [financialLedger.poolId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [financialLedger.userId],
    references: [user.id],
  }),
  week: one(weeklySchedules, {
    fields: [financialLedger.weekId],
    references: [weeklySchedules.id],
  }),
}));
```

- [ ] **Step 4: Add export to schema index**

Add to `src/server/db/schema/index.ts`:

```typescript
export * from "./financial.schema";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit tests/unit/schema/financial.schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/financial.schema.ts src/server/db/schema/index.ts tests/unit/schema/financial.schema.test.ts
git commit -m "feat: add financialLedger schema"
```

---

### Task 8: Generate and Apply Migration

**Files:**

- Create: `drizzle/XXXX_*.sql` (auto-generated)

- [ ] **Step 1: Generate Drizzle migration**

Run: `bun run db generate`
Expected: Migration file created in `drizzle/` with CREATE TABLE statements for all new tables

- [ ] **Step 2: Review the generated SQL**

Read the generated migration file and verify it contains:

- `CREATE TABLE players` with correct columns and indexes
- `CREATE TABLE games` with correct columns and indexes
- `CREATE TABLE goal_events` with unique constraint and indexes
- `CREATE TABLE goaltender_game_stats` with unique constraint and indexes
- `CREATE TABLE weekly_schedules` with unique constraint and indexes
- `CREATE TABLE rosters` with unique constraint and indexes
- `CREATE TABLE roster_slots` with index
- `CREATE TABLE roster_snapshots` with unique constraint
- `CREATE TABLE pool_config` with defaults
- `CREATE TABLE scoring_events` with indexes
- `CREATE TABLE weekly_scores` with unique constraint and index
- `CREATE TABLE financial_ledger` with index
- All foreign keys present

- [ ] **Step 3: Apply migration to local database**

Run: `bun run db migrate`
Expected: Migration applied, all tables created successfully

- [ ] **Step 4: Commit migration**

```bash
git add drizzle/
git commit -m "feat: add Phase 1 database migration"
```

---

## Chunk 3: API Service Wrappers

### Task 9: NHL Salary API Service Wrapper

**Files:**

- Create: `src/server/services/nhl-salary-api.ts`
- Create: `tests/unit/services/nhl-salary-api.test.ts`

- [ ] **Step 1: Write tests for the API wrapper**

```typescript
// tests/unit/services/nhl-salary-api.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the env module before importing the service
vi.mock("@/env/server", () => ({
  env: {
    NHL_SALARY_API_URL: "https://test-api.example.com",
    NHL_SALARY_API_KEY: "test-key-123",
  },
}));

// Must import after mock
const { fetchPlayers, fetchPlayerById, fetchInjuries, triggerPlayerScrape, triggerInjuryScrape } =
  await import("@/server/services/nhl-salary-api");

describe("nhl-salary-api", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchPlayers calls GET /players with bearer auth", async () => {
    await fetchPlayers();
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/players",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key-123",
        }),
      }),
    );
  });

  it("fetchPlayerById calls GET /players/{nhlId}", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          nhlId: 8478402,
          name: "Connor McDavid",
          team: "EDM",
          position: "C",
          salary: 12500000,
          injury: null,
        }),
    } as Response);

    const player = await fetchPlayerById(8478402);
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/players/8478402",
      expect.any(Object),
    );
    expect(player.name).toBe("Connor McDavid");
  });

  it("fetchInjuries calls GET /injuries", async () => {
    await fetchInjuries();
    expect(fetch).toHaveBeenCalledWith("https://test-api.example.com/injuries", expect.any(Object));
  });

  it("triggerPlayerScrape calls POST /admin/scrape/players", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Scrape initiated" }),
    } as Response);

    await triggerPlayerScrape();
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/admin/scrape/players",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("triggerInjuryScrape calls POST /admin/scrape/injuries", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Scrape initiated" }),
    } as Response);

    await triggerInjuryScrape();
    expect(fetch).toHaveBeenCalledWith(
      "https://test-api.example.com/admin/scrape/injuries",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(fetchPlayers()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/services/nhl-salary-api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the service wrapper**

```typescript
// src/server/services/nhl-salary-api.ts
import { env } from "@/env/server";

// ---------- Types ----------
export interface SalaryApiPlayer {
  nhlId: number;
  name: string;
  team: string;
  position: string;
  salary: number | null;
  injury: { status: string; description: string } | null;
}

export interface SalaryApiInjury {
  nhlId: number;
  name: string;
  status: string;
  description: string;
}

// ---------- Internal helpers ----------
async function salaryApiFetch<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(`${env.NHL_SALARY_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NHL_SALARY_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `NHL Salary API error: ${response.status} ${response.statusText} for ${method} ${path}`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------- Public API ----------
export function fetchPlayers(): Promise<SalaryApiPlayer[]> {
  return salaryApiFetch<SalaryApiPlayer[]>("/players");
}

export function fetchPlayerById(nhlId: number): Promise<SalaryApiPlayer> {
  return salaryApiFetch<SalaryApiPlayer>(`/players/${nhlId}`);
}

export function fetchInjuries(): Promise<SalaryApiInjury[]> {
  return salaryApiFetch<SalaryApiInjury[]>("/injuries");
}

export function triggerPlayerScrape(): Promise<{ message: string }> {
  return salaryApiFetch<{ message: string }>("/admin/scrape/players", "POST");
}

export function triggerInjuryScrape(): Promise<{ message: string }> {
  return salaryApiFetch<{ message: string }>("/admin/scrape/injuries", "POST");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/services/nhl-salary-api.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/server/services/nhl-salary-api.ts tests/unit/services/nhl-salary-api.test.ts
git commit -m "feat: add NHL Salary API service wrapper"
```

---

### Task 10: NHL-e API Service Wrapper

**Files:**

- Create: `src/server/services/nhle-api.ts`
- Create: `tests/unit/services/nhle-api.test.ts`

- [ ] **Step 1: Write tests for the NHL-e API wrapper**

```typescript
// tests/unit/services/nhle-api.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchScores, fetchSchedule, fetchPlayerGameLog } from "@/server/services/nhle-api";

describe("nhle-api", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchScores calls /v1/score/now", async () => {
    await fetchScores();
    expect(fetch).toHaveBeenCalledWith("https://api-web.nhle.com/v1/score/now", expect.any(Object));
  });

  it("fetchSchedule calls /v1/schedule/{date}", async () => {
    await fetchSchedule("2026-03-15");
    expect(fetch).toHaveBeenCalledWith(
      "https://api-web.nhle.com/v1/schedule/2026-03-15",
      expect.any(Object),
    );
  });

  it("fetchPlayerGameLog calls /v1/player/{id}/game-log/now", async () => {
    await fetchPlayerGameLog(8478402);
    expect(fetch).toHaveBeenCalledWith(
      "https://api-web.nhle.com/v1/player/8478402/game-log/now",
      expect.any(Object),
    );
  });

  it("throws on non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(fetchScores()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/services/nhle-api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the NHL-e API wrapper**

```typescript
// src/server/services/nhle-api.ts
const NHLE_BASE_URL = "https://api-web.nhle.com/v1";

// ---------- Types ----------
export interface NhleScoresResponse {
  games: NhleGame[];
  currentDate: string;
  prevDate: string;
  nextDate: string;
}

export interface NhleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue: { default: string };
  startTimeUTC: string;
  gameState: string;
  gameScheduleState: string;
  awayTeam: NhleTeam;
  homeTeam: NhleTeam;
  clock?: {
    timeRemaining: string;
    secondsRemaining: number;
    running: boolean;
    inIntermission: boolean;
  };
  period?: number;
  periodDescriptor?: { number: number; periodType: string };
  goals?: NhleGoal[];
}

export interface NhleTeam {
  id: number;
  name: { default: string };
  abbrev: string;
  score: number;
  sog: number;
  logo: string;
}

export interface NhleGoal {
  period: number;
  periodDescriptor: { number: number; periodType: string };
  timeInPeriod: string;
  playerId: number;
  name: { default: string };
  firstName: { default: string };
  lastName: { default: string };
  goalModifier: string;
  assists: NhleAssist[];
  teamAbbrev: string;
  goalsToDate: number;
  awayScore: number;
  homeScore: number;
  strength: string;
}

export interface NhleAssist {
  playerId: number;
  name: { default: string };
  assistsToDate: number;
}

export interface NhleScheduleResponse {
  gameWeek: NhleScheduleDay[];
}

export interface NhleScheduleDay {
  date: string;
  dayAbbrev: string;
  numberOfGames: number;
  games: NhleScheduleGame[];
}

export interface NhleScheduleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  startTimeUTC: string;
  gameState: string;
  awayTeam: { abbrev: string };
  homeTeam: { abbrev: string };
}

export interface NhleSkaterGameLog {
  gameId: number;
  teamAbbrev: string;
  gameDate: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shorthandedGoals: number;
  shorthandedPoints: number;
  gameWinningGoals: number;
  otGoals: number;
  shots: number;
  pim: number;
  toi: string;
}

export interface NhleGoalieGameLog {
  gameId: number;
  teamAbbrev: string;
  gameDate: string;
  gamesStarted: number;
  decision: string;
  shotsAgainst: number;
  goalsAgainst: number;
  savePctg: number;
  shutouts: number;
  toi: string;
  pim: number;
  goals: number;
  assists: number;
}

export interface NhleGameLogResponse {
  gameLog: (NhleSkaterGameLog | NhleGoalieGameLog)[];
  playerStatsSeasons: unknown[];
}

// ---------- Internal helpers ----------
async function nhleFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${NHLE_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`NHL-e API error: ${response.status} ${response.statusText} for GET ${path}`);
  }

  return response.json() as Promise<T>;
}

// ---------- Public API ----------
export function fetchScores(): Promise<NhleScoresResponse> {
  return nhleFetch<NhleScoresResponse>("/score/now");
}

export function fetchSchedule(date: string): Promise<NhleScheduleResponse> {
  return nhleFetch<NhleScheduleResponse>(`/schedule/${date}`);
}

export function fetchPlayerGameLog(nhlId: number): Promise<NhleGameLogResponse> {
  return nhleFetch<NhleGameLogResponse>(`/player/${nhlId}/game-log/now`);
}

export function fetchClubStats(team: string, season: string): Promise<unknown> {
  return nhleFetch(`/club-stats/${team}/${season}/2`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/services/nhle-api.test.ts`
Expected: PASS — all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/server/services/nhle-api.ts tests/unit/services/nhle-api.test.ts
git commit -m "feat: add NHL-e API service wrapper"
```

---

## Chunk 4: Data Sync Orchestration

### Task 11: syncPlayers

**Files:**

- Create: `src/server/services/data-sync.ts`
- Create: `tests/unit/services/data-sync.test.ts`

- [ ] **Step 1: Write test for syncPlayers**

```typescript
// tests/unit/services/data-sync.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/server/services/nhl-salary-api", () => ({
  fetchPlayers: vi.fn(),
  triggerPlayerScrape: vi.fn(),
  triggerInjuryScrape: vi.fn(),
}));

vi.mock("@/server/db", () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue([]),
  };
  return { db: mockDb };
});

const { fetchPlayers, triggerPlayerScrape } = await import("@/server/services/nhl-salary-api");
const { syncPlayers } = await import("@/server/services/data-sync");

describe("syncPlayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls fetchPlayers and returns count", async () => {
    vi.mocked(fetchPlayers).mockResolvedValueOnce([
      {
        nhlId: 8478402,
        name: "Connor McDavid",
        team: "EDM",
        position: "C",
        salary: 12500000,
        injury: null,
      },
      {
        nhlId: 8479318,
        name: "Auston Matthews",
        team: "TOR",
        position: "C",
        salary: 13250000,
        injury: { status: "Day-to-Day", description: "Upper body" },
      },
    ]);

    const result = await syncPlayers();
    expect(fetchPlayers).toHaveBeenCalled();
    expect(result.count).toBe(2);
    expect(result.syncedAt).toBeInstanceOf(Date);
  });

  it("triggers upstream scrape when triggerScrape=true", async () => {
    vi.mocked(triggerPlayerScrape).mockResolvedValueOnce({
      message: "OK",
    });
    vi.mocked(fetchPlayers).mockResolvedValueOnce([]);

    await syncPlayers({ triggerScrape: true });
    expect(triggerPlayerScrape).toHaveBeenCalled();
  });

  it("does not trigger upstream scrape by default", async () => {
    vi.mocked(fetchPlayers).mockResolvedValueOnce([]);

    await syncPlayers();
    expect(triggerPlayerScrape).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement syncPlayers in data-sync.ts**

```typescript
// src/server/services/data-sync.ts
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { players } from "@/server/db/schema/players.schema";
import {
  fetchPlayers as apiFetchPlayers,
  triggerPlayerScrape,
  triggerInjuryScrape,
} from "@/server/services/nhl-salary-api";

// ---------- syncPlayers ----------
export async function syncPlayers(
  options: { triggerScrape?: boolean } = {},
): Promise<{ count: number; syncedAt: Date }> {
  if (options.triggerScrape) {
    await triggerPlayerScrape();
  }

  const apiPlayers = await apiFetchPlayers();
  const now = new Date();

  for (const p of apiPlayers) {
    await db
      .insert(players)
      .values({
        nhlId: p.nhlId,
        name: p.name,
        team: p.team,
        position: p.position,
        salary: p.salary,
        injuryStatus: p.injury?.status ?? null,
        injuryDescription: p.injury?.description ?? null,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: players.nhlId,
        set: {
          name: p.name,
          team: p.team,
          position: p.position,
          salary: p.salary,
          injuryStatus: p.injury?.status ?? null,
          injuryDescription: p.injury?.description ?? null,
          lastSyncedAt: now,
        },
      });
  }

  return { count: apiPlayers.length, syncedAt: now };
}

// ---------- syncInjuries ----------
export async function syncInjuries(): Promise<{
  count: number;
  syncedAt: Date;
}> {
  await triggerInjuryScrape();
  return syncPlayers();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/data-sync.ts tests/unit/services/data-sync.test.ts
git commit -m "feat: add syncPlayers and syncInjuries data sync"
```

---

### Task 12: syncSchedule

**Files:**

- Modify: `src/server/services/data-sync.ts`
- Modify: `tests/unit/services/data-sync.test.ts`

- [ ] **Step 1: Write test for syncSchedule**

Add to `tests/unit/services/data-sync.test.ts`:

```typescript
vi.mock("@/server/services/nhle-api", () => ({
  fetchSchedule: vi.fn(),
  fetchScores: vi.fn(),
  fetchPlayerGameLog: vi.fn(),
}));

const { fetchSchedule } = await import("@/server/services/nhle-api");
const { syncSchedule } = await import("@/server/services/data-sync");

describe("syncSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls fetchSchedule with provided date", async () => {
    vi.mocked(fetchSchedule).mockResolvedValueOnce({
      gameWeek: [
        {
          date: "2026-03-16",
          dayAbbrev: "MON",
          numberOfGames: 2,
          games: [
            {
              id: 2025021050,
              season: 20252026,
              gameType: 2,
              gameDate: "2026-03-16",
              startTimeUTC: "2026-03-16T23:00:00Z",
              gameState: "FUT",
              awayTeam: { abbrev: "EDM" },
              homeTeam: { abbrev: "TOR" },
            },
          ],
        },
      ],
    });

    const result = await syncSchedule("2026-03-16");
    expect(fetchSchedule).toHaveBeenCalledWith("2026-03-16");
    expect(result.gamesUpserted).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: FAIL — syncSchedule not exported

- [ ] **Step 3: Implement syncSchedule**

Add to `src/server/services/data-sync.ts`:

```typescript
import { games } from "@/server/db/schema/players.schema";
import { weeklySchedules } from "@/server/db/schema/schedule.schema";
import { organization } from "@/server/db/schema/auth.schema";
import { fetchSchedule as apiFetchSchedule } from "@/server/services/nhle-api";
import { and, ne, sql } from "drizzle-orm";

export async function syncSchedule(
  date: string,
): Promise<{ gamesUpserted: number; syncedAt: Date }> {
  const schedule = await apiFetchSchedule(date);
  const now = new Date();
  let gamesUpserted = 0;

  for (const day of schedule.gameWeek) {
    for (const game of day.games) {
      await db
        .insert(games)
        .values({
          nhlGameId: game.id,
          season: String(game.season),
          gameDate: game.gameDate,
          gameType: game.gameType,
          homeTeam: game.homeTeam.abbrev,
          awayTeam: game.awayTeam.abbrev,
          gameState: game.gameState,
          startTimeUtc: new Date(game.startTimeUTC),
          lastSyncedAt: now,
        })
        .onConflictDoUpdate({
          target: games.nhlGameId,
          set: {
            gameState: game.gameState,
            startTimeUtc: new Date(game.startTimeUTC),
            lastSyncedAt: now,
          },
        });
      gamesUpserted++;
    }
  }

  // Auto-generate weekly boundaries for all active pools
  await generateWeeklyBoundaries();

  return { gamesUpserted, syncedAt: now };
}

async function generateWeeklyBoundaries(): Promise<void> {
  // Get all pools (organizations)
  const pools = await db.select({ id: organization.id }).from(organization);

  // Get all season games ordered by date
  const allGames = await db
    .select({
      gameDate: games.gameDate,
      startTimeUtc: games.startTimeUtc,
    })
    .from(games)
    .orderBy(games.gameDate);

  if (allGames.length === 0) return;

  // Bucket games into Mon-Sun weeks
  const weeks = bucketIntoWeeks(allGames);

  for (const pool of pools) {
    for (const week of weeks) {
      // Skip overridden weeks
      const existing = await db
        .select()
        .from(weeklySchedules)
        .where(
          and(eq(weeklySchedules.poolId, pool.id), eq(weeklySchedules.weekNumber, week.weekNumber)),
        )
        .limit(1);

      if (existing.length > 0 && existing[0].isOverridden) continue;

      await db
        .insert(weeklySchedules)
        .values({
          poolId: pool.id,
          weekNumber: week.weekNumber,
          startDate: week.startDate,
          endDate: week.endDate,
          lockTime: week.lockTime,
        })
        .onConflictDoUpdate({
          target: [weeklySchedules.poolId, weeklySchedules.weekNumber],
          set: {
            startDate: week.startDate,
            endDate: week.endDate,
            lockTime: week.lockTime,
          },
        });
    }
  }
}

interface WeekBucket {
  weekNumber: number;
  startDate: string;
  endDate: string;
  lockTime: Date;
}

function bucketIntoWeeks(sortedGames: { gameDate: string; startTimeUtc: Date }[]): WeekBucket[] {
  const weeks = new Map<string, WeekBucket>();
  let weekCounter = 0;

  for (const game of sortedGames) {
    const gameDate = new Date(game.gameDate + "T00:00:00Z");
    // Get Monday of this game's week
    const day = gameDate.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(gameDate);
    monday.setUTCDate(monday.getUTCDate() + diffToMonday);
    const mondayStr = monday.toISOString().split("T")[0];

    if (!weeks.has(mondayStr)) {
      weekCounter++;
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      weeks.set(mondayStr, {
        weekNumber: weekCounter,
        startDate: mondayStr,
        endDate: sunday.toISOString().split("T")[0],
        lockTime: game.startTimeUtc,
      });
    } else {
      // Update lockTime if this game starts earlier
      const existing = weeks.get(mondayStr)!;
      if (game.startTimeUtc < existing.lockTime) {
        existing.lockTime = game.startTimeUtc;
      }
    }
  }

  return Array.from(weeks.values());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/data-sync.ts tests/unit/services/data-sync.test.ts
git commit -m "feat: add syncSchedule with weekly boundary generation"
```

---

### Task 13: syncLiveScoring

**Files:**

- Modify: `src/server/services/data-sync.ts`
- Modify: `tests/unit/services/data-sync.test.ts`

- [ ] **Step 1: Write tests for syncLiveScoring**

Add to `tests/unit/services/data-sync.test.ts`:

```typescript
const { fetchScores } = await import("@/server/services/nhle-api");
const { syncLiveScoring, _isWithinGameWindow } = await import("@/server/services/data-sync");

describe("syncLiveScoring", () => {
  it("short-circuits outside game window", async () => {
    // 4 AM ET = outside 11am-1:30am window
    const result = await syncLiveScoring(
      new Date("2026-03-16T09:00:00Z"), // 4am ET
    );
    expect(result.skipped).toBe(true);
    expect(fetchScores).not.toHaveBeenCalled();
  });
});

describe("_isWithinGameWindow", () => {
  it("returns true during evening game hours", () => {
    // 8pm ET = 2026-03-17T01:00:00Z (during DST)
    expect(_isWithinGameWindow(new Date("2026-03-17T00:00:00Z"))).toBe(true);
  });

  it("returns false at 4am ET", () => {
    expect(_isWithinGameWindow(new Date("2026-03-17T08:00:00Z"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: FAIL — syncLiveScoring not exported

- [ ] **Step 3: Implement syncLiveScoring**

Add to `src/server/services/data-sync.ts`:

```typescript
import { goalEvents } from "@/server/db/schema/players.schema";
import { fetchScores as apiFetchScores } from "@/server/services/nhle-api";

// Exported for testing
export function _isWithinGameWindow(now: Date): boolean {
  // Convert to ET hours (approximate — handles EDT/EST)
  const utcHour = now.getUTCHours();
  // ET is UTC-5 (EST) or UTC-4 (EDT)
  // Game window: 11am ET to 1:30am ET next day
  // In UTC: ~15:00 to ~06:30 (EST) or ~15:00 to ~05:30 (EDT)
  // Simplified: allow 15:00-06:30 UTC (covers both EST and EDT)
  return utcHour >= 15 || utcHour < 7;
}

export async function syncLiveScoring(now: Date = new Date()): Promise<{
  skipped: boolean;
  gamesUpdated: number;
  goalsUpserted: number;
  syncedAt: Date;
}> {
  // Guard 1: Time window
  if (!_isWithinGameWindow(now)) {
    return { skipped: true, gamesUpdated: 0, goalsUpserted: 0, syncedAt: now };
  }

  // Guard 2: Check for active games today
  const todayStr = now.toISOString().split("T")[0];
  const activeGames = await db
    .select()
    .from(games)
    .where(
      and(eq(games.gameDate, todayStr), ne(games.gameState, "FINAL"), ne(games.gameState, "OFF")),
    );

  if (activeGames.length === 0) {
    return { skipped: true, gamesUpdated: 0, goalsUpserted: 0, syncedAt: now };
  }

  // Fetch live scores
  const scores = await apiFetchScores();
  let gamesUpdated = 0;
  let goalsUpserted = 0;

  for (const game of scores.games) {
    // Upsert game state
    await db
      .insert(games)
      .values({
        nhlGameId: game.id,
        season: String(game.season),
        gameDate: game.gameDate,
        gameType: game.gameType,
        homeTeam: game.homeTeam.abbrev,
        awayTeam: game.awayTeam.abbrev,
        homeScore: game.homeTeam.score,
        awayScore: game.awayTeam.score,
        gameState: game.gameState,
        startTimeUtc: new Date(game.startTimeUTC),
        period: game.period ?? null,
        timeRemaining: game.clock?.timeRemaining ?? null,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: games.nhlGameId,
        set: {
          homeScore: game.homeTeam.score,
          awayScore: game.awayTeam.score,
          gameState: game.gameState,
          period: game.period ?? null,
          timeRemaining: game.clock?.timeRemaining ?? null,
          lastSyncedAt: now,
        },
      });
    gamesUpdated++;

    // Upsert goal events
    if (game.goals) {
      // Look up the game's internal ID
      const [dbGame] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.nhlGameId, game.id))
        .limit(1);

      if (dbGame) {
        for (const goal of game.goals) {
          await db
            .insert(goalEvents)
            .values({
              gameId: dbGame.id,
              nhlGameId: game.id,
              scorerNhlId: goal.playerId,
              period: goal.period,
              timeInPeriod: goal.timeInPeriod,
              strength: goal.strength,
              goalModifier: goal.goalModifier || null,
              assistNhlIds: goal.assists.map((a) => a.playerId),
              homeScore: goal.homeScore,
              awayScore: goal.awayScore,
            })
            .onConflictDoNothing();
          goalsUpserted++;
        }
      }
    }
  }

  // TODO: Phase 2 — incrementally update weeklyScores for affected pools
  // once the scoring engine exists. For now, syncLiveScoring only captures
  // raw game states and goal events into the database.

  return { skipped: false, gamesUpdated, goalsUpserted, syncedAt: now };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/data-sync.ts tests/unit/services/data-sync.test.ts
git commit -m "feat: add syncLiveScoring with schedule-aware guards"
```

---

### Task 13b: Nightly Reconciliation — Goaltender Stats Sync

The full nightly reconciliation (scoring engine cross-reference, weeklyScores rebuild, discrepancy logging) depends on the scoring engine from Phase 2. However, the goaltender game stats sync can be implemented now since the schema exists and the data is needed for Phase 2.

**Files:**

- Modify: `src/server/services/data-sync.ts`
- Modify: `tests/unit/services/data-sync.test.ts`

- [ ] **Step 1: Write test for syncGoaltenderStats**

Add to `tests/unit/services/data-sync.test.ts`:

```typescript
const { fetchPlayerGameLog } = await import("@/server/services/nhle-api");
const { syncGoaltenderStats } = await import("@/server/services/data-sync");

describe("syncGoaltenderStats", () => {
  it("fetches game logs for provided goaltender IDs", async () => {
    vi.mocked(fetchPlayerGameLog).mockResolvedValue({
      gameLog: [
        {
          gameId: 2025021050,
          teamAbbrev: "EDM",
          gameDate: "2026-03-16",
          gamesStarted: 1,
          decision: "W",
          shotsAgainst: 28,
          goalsAgainst: 2,
          savePctg: 0.928571,
          shutouts: 0,
          toi: "60:00",
          pim: 0,
          goals: 0,
          assists: 0,
        },
      ],
      playerStatsSeasons: [],
    });

    const result = await syncGoaltenderStats([8479361]);
    expect(fetchPlayerGameLog).toHaveBeenCalledWith(8479361);
    expect(result.statsUpserted).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: FAIL — syncGoaltenderStats not exported

- [ ] **Step 3: Implement syncGoaltenderStats**

Add to `src/server/services/data-sync.ts`:

```typescript
import { goaltenderGameStats } from "@/server/db/schema/players.schema";
import { fetchPlayerGameLog, type NhleGoalieGameLog } from "@/server/services/nhle-api";

export async function syncGoaltenderStats(
  goaltenderNhlIds: number[],
): Promise<{ statsUpserted: number }> {
  let statsUpserted = 0;

  for (const nhlId of goaltenderNhlIds) {
    const { gameLog } = await fetchPlayerGameLog(nhlId);

    for (const entry of gameLog) {
      // Only process goalie game logs (have decision/shotsAgainst fields)
      const goalieEntry = entry as NhleGoalieGameLog;
      if (!("shotsAgainst" in goalieEntry)) continue;

      // Find the game in our DB
      const [dbGame] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.nhlGameId, goalieEntry.gameId))
        .limit(1);

      if (!dbGame) continue;

      await db
        .insert(goaltenderGameStats)
        .values({
          gameId: dbGame.id,
          nhlGameId: goalieEntry.gameId,
          goaltenderNhlId: nhlId,
          decision: goalieEntry.decision || null,
          shotsAgainst: goalieEntry.shotsAgainst,
          goalsAgainst: goalieEntry.goalsAgainst,
          savePctg: goalieEntry.savePctg,
          shutout: goalieEntry.shutouts === 1,
          toi: goalieEntry.toi,
        })
        .onConflictDoUpdate({
          target: [goaltenderGameStats.nhlGameId, goaltenderGameStats.goaltenderNhlId],
          set: {
            decision: goalieEntry.decision || null,
            shotsAgainst: goalieEntry.shotsAgainst,
            goalsAgainst: goalieEntry.goalsAgainst,
            savePctg: goalieEntry.savePctg,
            shutout: goalieEntry.shutouts === 1,
            toi: goalieEntry.toi,
          },
        });
      statsUpserted++;
    }

    // Rate-limit courtesy: 100ms between player requests
    await new Promise((r) => setTimeout(r, 100));
  }

  return { statsUpserted };
}
```

Note: The full nightly reconciliation (cross-referencing goalEvents, rebuilding weeklyScores, logging discrepancies) is deferred to Phase 2 when the scoring engine exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/services/data-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/data-sync.ts tests/unit/services/data-sync.test.ts
git commit -m "feat: add syncGoaltenderStats for nightly goalie data"
```

---

## Chunk 5: Server Functions & Final Integration

### Task 14: Admin Server Functions

**Files:**

- Create: `src/server/functions/admin.ts`

- [ ] **Step 1: Create admin server functions**

```typescript
// src/server/functions/admin.ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "drizzle-orm";

import { auth } from "@/lib/auth/auth";
import { db } from "@/server/db";
import { players, games } from "@/server/db/schema/players.schema";
import { syncPlayers, syncInjuries } from "@/server/services/data-sync";

async function requireOwner() {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Unauthorized");

  // Check if user is owner of the active organization
  if (!session.session.activeOrganizationId) {
    throw new Error("No active pool");
  }

  const fullOrg = await auth.api.getFullOrganization({
    query: { organizationId: session.session.activeOrganizationId },
    headers: request.headers,
  });

  const member = fullOrg?.members?.find((m) => m.userId === session.user.id);

  if (!member || member.role !== "owner") {
    throw new Error("Owner access required");
  }

  return session;
}

export const $syncPlayers = createServerFn({ method: "POST" }).handler(async () => {
  await requireOwner();
  return syncPlayers({ triggerScrape: true });
});

export const $syncInjuries = createServerFn({ method: "POST" }).handler(async () => {
  await requireOwner();
  return syncInjuries();
});

export const $getSyncStatus = createServerFn({ method: "GET" }).handler(async () => {
  await requireOwner();

  const [playerSync] = await db
    .select({ lastSyncedAt: sql<Date>`MAX(${players.lastSyncedAt})` })
    .from(players);

  const [gameSync] = await db
    .select({ lastSyncedAt: sql<Date>`MAX(${games.lastSyncedAt})` })
    .from(games);

  return {
    players: playerSync?.lastSyncedAt ?? null,
    games: gameSync?.lastSyncedAt ?? null,
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add src/server/functions/admin.ts
git commit -m "feat: add admin server functions for sync triggers"
```

---

### Task 15: Pool Config & Schedule Server Functions

**Files:**

- Modify: `src/server/functions/pool.ts`

- [ ] **Step 1: Add pool config and schedule functions**

Add the following to `src/server/functions/pool.ts`. Merge these imports with the existing ones at the top of the file (do not duplicate `createServerFn`, `getRequest`, `auth`, or `z` imports):

```typescript
// Add to existing imports:
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { poolConfig } from "@/server/db/schema/scoring.schema";
import { weeklySchedules } from "@/server/db/schema/schedule.schema";
import { games } from "@/server/db/schema/players.schema";

// Helper to verify pool membership
async function requirePoolMember(poolId: string) {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Unauthorized");

  const orgs = await auth.api.listOrganizations({ headers: request.headers });
  const pool = orgs.find((org) => org.id === poolId);
  if (!pool) throw new Error("Not a member of this pool");

  return session;
}

export const $getPoolConfig = createServerFn({ method: "GET" })
  .inputValidator(z.object({ poolId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requirePoolMember(data.poolId);

    const [config] = await db
      .select()
      .from(poolConfig)
      .where(eq(poolConfig.poolId, data.poolId))
      .limit(1);

    return config ?? null;
  });

export const $getWeeklySchedule = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      poolId: z.string().min(1),
      weekNumber: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requirePoolMember(data.poolId);

    // If no weekNumber specified, find the current week
    let weekNumber = data.weekNumber;
    if (!weekNumber) {
      const today = new Date().toISOString().split("T")[0];
      const [currentWeek] = await db
        .select()
        .from(weeklySchedules)
        .where(
          and(
            eq(weeklySchedules.poolId, data.poolId),
            sql`${weeklySchedules.startDate} <= ${today}`,
            sql`${weeklySchedules.endDate} >= ${today}`,
          ),
        )
        .limit(1);

      if (!currentWeek) return null;
      weekNumber = currentWeek.weekNumber;
    }

    const [week] = await db
      .select()
      .from(weeklySchedules)
      .where(
        and(eq(weeklySchedules.poolId, data.poolId), eq(weeklySchedules.weekNumber, weekNumber)),
      )
      .limit(1);

    if (!week) return null;

    // Get games for this week
    const weekGames = await db
      .select()
      .from(games)
      .where(
        and(sql`${games.gameDate} >= ${week.startDate}`, sql`${games.gameDate} <= ${week.endDate}`),
      )
      .orderBy(games.startTimeUtc);

    return { ...week, games: weekGames };
  });
```

- [ ] **Step 2: Verify the app builds**

Run: `bun run build`
Expected: Build completes without type errors

- [ ] **Step 3: Commit**

```bash
git add src/server/functions/pool.ts
git commit -m "feat: add pool config and weekly schedule server functions"
```

---

### Task 16: Run All Tests & Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `bun run test:unit`
Expected: All tests pass

- [ ] **Step 2: Run linter**

Run: `bun run lint`
Expected: No errors

- [ ] **Step 3: Verify app builds cleanly**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Verify schema is in sync**

Run: `bun run db generate`
Expected: "No schema changes detected" — confirms migration covers all schema

- [ ] **Step 5: Commit any final fixes if needed**

```bash
git add -A
git commit -m "chore: Phase 1 final cleanup"
```
