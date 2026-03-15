# Phase 1: Data Model & External APIs — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Phase:** 1 of 5 (Implementation Roadmap)

## Overview

Phase 1 builds the data foundation that all subsequent phases read from. It includes the full Drizzle schema for every domain (players, rosters, scoring, financials, schedules), service wrappers for two external NHL APIs, and a data sync orchestration layer that keeps Postgres up to date.

No UI is built in this phase. Server functions provide read-only access for future phases and admin sync triggers.

## Architecture Decisions

### DB as Cache

The app never queries external APIs during user requests. All NHL data is synced into Postgres on a schedule or by admin trigger. The app reads from the database exclusively. Synced entity tables (`players`, `games`) track `lastSyncedAt` for staleness indicators. Append-only event tables (`goalEvents`, `goaltenderGameStats`) do not track staleness — their immutability makes it unnecessary.

### Stale Data, Not Errors

If an external API is unavailable, the app serves cached data with a staleness indicator. API failures are logged but never surface as user-facing errors.

### Append-Only Tables

- **`financialLedger`**: No UPDATE/DELETE. Corrections are new rows with a "correction" event type. Running balance = `SUM(amount)`.
- **`rosterSnapshots`**: Immutable after lock time. Scoring always runs against snapshots.
- **`scoringEvents`**: Audit trail — every point traceable to an NHL game event. User-facing for transparency.

### Schema Organization

Domain-grouped files, each re-exported from `schema/index.ts`:

- `players.schema.ts` — players, games, goal events, goaltender game stats
- `schedule.schema.ts` — weekly schedules
- `roster.schema.ts` — rosters, roster slots, roster snapshots
- `scoring.schema.ts` — pool config, scoring events, weekly scores
- `financial.schema.ts` — financial ledger

### Pool Configuration

Single `poolConfig` row per pool. Boolean columns for critical toggles (`captainMode`, `goaltendingMode`). JSONB columns for structured config (`scoringRules`, `rosterConstraints`).

### Scoring Events

Hybrid approach: raw `scoringEvents` for audit trail + materialized `weeklyScores` summary rebuilt nightly and updated incrementally during live scoring.

---

## Drizzle Schema

### `players` (synced from NHL Salary API)

| Column              | Type              | Notes                     |
| ------------------- | ----------------- | ------------------------- |
| `id`                | uuid              | PK                        |
| `nhlId`             | integer           | Unique. NHL's player ID   |
| `name`              | text              |                           |
| `team`              | text              | 3-letter abbreviation     |
| `position`          | text              | "C", "LW", "RW", "D", "G" |
| `salary`            | integer, nullable | AAV in whole dollars      |
| `injuryStatus`      | text, nullable    | e.g. "Day-to-Day", "IR"   |
| `injuryDescription` | text, nullable    |                           |
| `lastSyncedAt`      | timestamp         | Staleness tracking        |

**Indexes:** `nhlId` (unique), `team`, `position`

### `games` (synced from NHL-e API)

| Column          | Type              | Notes                            |
| --------------- | ----------------- | -------------------------------- |
| `id`            | uuid              | PK                               |
| `nhlGameId`     | integer           | Unique. NHL's game ID            |
| `season`        | text              | e.g. "20252026"                  |
| `gameDate`      | date              |                                  |
| `gameType`      | integer           | 2=regular, 3=playoffs            |
| `homeTeam`      | text              | 3-letter abbreviation            |
| `awayTeam`      | text              | 3-letter abbreviation            |
| `homeScore`     | integer, nullable |                                  |
| `awayScore`     | integer, nullable |                                  |
| `gameState`     | text              | "FUT", "LIVE", "OFF", "FINAL"    |
| `startTimeUtc`  | timestamp         |                                  |
| `period`        | integer, nullable | Current period during live games |
| `timeRemaining` | text, nullable    | Clock during live games          |
| `lastSyncedAt`  | timestamp         |                                  |

**Indexes:** `nhlGameId` (unique), `gameDate`, `(homeTeam)`, `(awayTeam)`

### `goalEvents` (synced from NHL-e API)

| Column         | Type           | Notes                                      |
| -------------- | -------------- | ------------------------------------------ |
| `id`           | uuid           | PK                                         |
| `gameId`       | uuid           | FK → games.id                              |
| `nhlGameId`    | integer        | Denormalized for fast lookups without join |
| `scorerNhlId`  | integer        | Logical reference to players.nhlId         |
| `period`       | integer        |                                            |
| `timeInPeriod` | text           |                                            |
| `strength`     | text           | "ev", "pp", "sh"                           |
| `goalModifier` | text, nullable | "empty-net", etc.                          |
| `assistNhlIds` | integer[]      | 0-2 assist player IDs                      |
| `homeScore`    | integer        | Score after this goal                      |
| `awayScore`    | integer        | Score after this goal                      |

**Unique constraint:** `(nhlGameId, scorerNhlId, period, timeInPeriod, homeScore, awayScore)` — includes score-after to handle the edge case of two goals by the same player at the same clock time.

**Indexes:** `gameId`, `scorerNhlId`, `nhlGameId`

Note: No `lastSyncedAt` — goal events are append-only and never updated once written.

### `goaltenderGameStats` (synced from NHL-e API game logs)

| Column            | Type           | Notes                                                 |
| ----------------- | -------------- | ----------------------------------------------------- |
| `id`              | uuid           | PK                                                    |
| `gameId`          | uuid           | FK → games.id                                         |
| `nhlGameId`       | integer        | Denormalized for fast lookups                         |
| `goaltenderNhlId` | integer        | Logical reference to players.nhlId                    |
| `decision`        | text, nullable | "W", "L", "O" (win/loss/OT loss), null if not starter |
| `shotsAgainst`    | integer        |                                                       |
| `goalsAgainst`    | integer        |                                                       |
| `savePctg`        | real           |                                                       |
| `shutout`         | boolean        |                                                       |
| `toi`             | text           | Time on ice "MM:SS"                                   |

**Unique constraint:** `(nhlGameId, goaltenderNhlId)`

**Indexes:** `gameId`, `goaltenderNhlId`, `nhlGameId`

This table is the source of truth for goaltending scoring (wins, shutouts, OT losses). Synced during nightly reconciliation via `fetchPlayerGameLog()` for each goaltender on a rostered team.

### `weeklySchedules`

| Column         | Type      | Notes                                 |
| -------------- | --------- | ------------------------------------- |
| `id`           | uuid      | PK                                    |
| `poolId`       | text      | FK → organization                     |
| `weekNumber`   | integer   |                                       |
| `startDate`    | date      | Monday                                |
| `endDate`      | date      | Sunday                                |
| `lockTime`     | timestamp | First scheduled puck drop of the week |
| `isOverridden` | boolean   | Default false. True if admin adjusted |
| `createdAt`    | timestamp |                                       |

**Unique constraint:** `(poolId, weekNumber)`

**Indexes:** `(poolId, weekNumber)`, `(poolId, startDate, endDate)`

**Auto-generation lifecycle:** Weekly schedules are generated per pool. When `syncSchedule()` runs, it generates/updates weeks for all active pools (skipping `isOverridden = true` rows). When a new pool is created mid-season, the next `syncSchedule()` run creates all weeks for the current season — including past weeks (needed for historical views, even though rosters won't exist for them).

### `rosters`

| Column      | Type      | Notes                           |
| ----------- | --------- | ------------------------------- |
| `id`        | uuid      | PK                              |
| `poolId`    | text      | FK → organization               |
| `userId`    | text      | FK → user                       |
| `weekId`    | uuid      | FK → weeklySchedules            |
| `isLocked`  | boolean   | Default false. Set at lock time |
| `createdAt` | timestamp |                                 |
| `updatedAt` | timestamp |                                 |

**Unique constraint:** `(poolId, userId, weekId)` — one roster per user per week per pool.

**Indexes:** `(poolId, userId, weekId)`

### `rosterSlots`

| Column        | Type    | Notes                                        |
| ------------- | ------- | -------------------------------------------- |
| `id`          | uuid    | PK                                           |
| `rosterId`    | uuid    | FK → rosters                                 |
| `playerNhlId` | integer | Logical reference to players.nhlId           |
| `position`    | text    | Slot type: "F", "D", "G"                     |
| `isCaptain`   | boolean | Default false. Captain designation for 2x    |
| `salary`      | integer | Snapshot of player salary at assignment time |

**Position mapping:** Player positions C/LW/RW map to "F" slots, D maps to "D" slots, G maps to "G" slots.

**Indexes:** `rosterId`

### `rosterSnapshots` (append-only)

| Column      | Type      | Notes                                                          |
| ----------- | --------- | -------------------------------------------------------------- |
| `id`        | uuid      | PK                                                             |
| `poolId`    | text      | FK → organization                                              |
| `userId`    | text      | FK → user                                                      |
| `weekId`    | uuid      | FK → weeklySchedules                                           |
| `slots`     | JSONB     | Frozen array: `[{ playerNhlId, position, isCaptain, salary }]` |
| `createdAt` | timestamp |                                                                |

**Unique constraint:** `(poolId, userId, weekId)` — one snapshot per user per week per pool.

Scoring engine reads from snapshots, never from editable rosters.

### `poolConfig`

| Column              | Type              | Notes                                        |
| ------------------- | ----------------- | -------------------------------------------- |
| `id`                | uuid              | PK                                           |
| `poolId`            | text              | FK → organization, unique                    |
| `salaryCap`         | integer, nullable | AAV in whole dollars. Null = no cap          |
| `captainMode`       | boolean           | Default false                                |
| `goaltendingMode`   | text              | Default "team". Values: "team", "individual" |
| `rosterConstraints` | JSONB             | `{ forwards: 6, defensemen: 4, goalies: 2 }` |
| `scoringRules`      | JSONB             | See below                                    |
| `createdAt`         | timestamp         |                                              |
| `updatedAt`         | timestamp         |                                              |

**Scoring rules structure:**

```json
{
  "forward": { "goal": 2, "assist": 1, "hatTrick": 2 },
  "defenseman": { "goal": 2, "assist": 1, "hatTrick": 2 },
  "goalie": { "goal": 2, "assist": 1 },
  "goaltending": { "win": 2, "shutout": 2, "overtimeLoss": 1 }
}
```

- `goalie` = offensive contributions (always attributed to individual)
- `goaltending` = goaltending stats (attributed per `goaltendingMode` — team or individual)
- Goaltending stats are sourced from the `goaltenderGameStats` table
- In team mode, goalies don't count against salary cap
- In individual mode, goalies count against cap and `goalie` + `goaltending` stats merge onto the individual

### `scoringEvents` (audit trail)

| Column           | Type      | Notes                                                          |
| ---------------- | --------- | -------------------------------------------------------------- |
| `id`             | uuid      | PK                                                             |
| `poolId`         | text      | FK → organization                                              |
| `weekId`         | uuid      | FK → weeklySchedules                                           |
| `userId`         | text      | FK → user                                                      |
| `playerNhlId`    | integer   | Logical reference to players.nhlId                             |
| `nhlGameId`      | integer   | Logical reference to games.nhlGameId                           |
| `eventType`      | text      | "goal", "assist", "hatTrick", "win", "shutout", "overtimeLoss" |
| `points`         | integer   | Final points (after captain multiplier)                        |
| `basePoints`     | integer   | Points before captain multiplier                               |
| `isCaptainBonus` | boolean   | Default false                                                  |
| `createdAt`      | timestamp |                                                                |

User-facing audit trail — every point traceable to a specific NHL game event for transparency.

Note: `playerNhlId` and `nhlGameId` are logical references (not FK constraints) to avoid constraint issues during sync ordering. Joined via `players.nhlId` and `games.nhlGameId` respectively.

**Indexes:** `(poolId, weekId, userId)`, `nhlGameId`

### `weeklyScores` (materialized summary)

| Column        | Type      | Notes                |
| ------------- | --------- | -------------------- |
| `id`          | uuid      | PK                   |
| `poolId`      | text      | FK → organization    |
| `weekId`      | uuid      | FK → weeklySchedules |
| `userId`      | text      | FK → user            |
| `totalPoints` | integer   |                      |
| `isWinner`    | boolean   | Default false        |
| `updatedAt`   | timestamp |                      |

**Unique constraint:** `(poolId, weekId, userId)` — upsert target for nightly rebuild.

**Indexes:** `(poolId, weekId)`

Rebuilt nightly. Updated incrementally during live scoring.

### `financialLedger` (append-only)

| Column        | Type           | Notes                                                                          |
| ------------- | -------------- | ------------------------------------------------------------------------------ |
| `id`          | uuid           | PK                                                                             |
| `poolId`      | text           | FK → organization                                                              |
| `userId`      | text           | FK → user                                                                      |
| `weekId`      | uuid, nullable | Null for non-week entries (fees)                                               |
| `eventType`   | text           | "weeklyLoss", "weeklyWin", "adminFee", "seasonPrize", "entryFee", "correction" |
| `amount`      | integer        | In cents. Positive = credit, negative = debit                                  |
| `description` | text, nullable | Human-readable note                                                            |
| `createdAt`   | timestamp      |                                                                                |

Running balance per member = `SUM(amount) WHERE userId = ? AND poolId = ?`.

**Indexes:** `(poolId, userId)`

---

## API Service Wrappers

### `src/server/services/nhl-salary-api.ts`

Thin typed wrapper for Kellen's NHL Salary API (`NHL_SALARY_API_URL` env var).

| Function                 | HTTP | Endpoint                 | Returns       |
| ------------------------ | ---- | ------------------------ | ------------- |
| `fetchPlayers()`         | GET  | `/players`               | `Player[]`    |
| `fetchPlayerById(nhlId)` | GET  | `/players/{nhlId}`       | `Player`      |
| `fetchInjuries()`        | GET  | `/injuries`              | `Injury[]`    |
| `triggerPlayerScrape()`  | POST | `/admin/scrape/players`  | `{ message }` |
| `triggerInjuryScrape()`  | POST | `/admin/scrape/injuries` | `{ message }` |

- Bearer auth via `NHL_SALARY_API_KEY` env var
- All methods return typed responses, throw on non-2xx
- Response types derived from OpenAPI spec

### `src/server/services/nhle-api.ts`

Wrapper for the public NHL-e API (`https://api-web.nhle.com/v1`).

| Function                       | HTTP | Endpoint                           | Returns                            |
| ------------------------------ | ---- | ---------------------------------- | ---------------------------------- |
| `fetchScores()`                | GET  | `/v1/score/now`                    | Today's games + goal events        |
| `fetchSchedule(date)`          | GET  | `/v1/schedule/{date}`              | Weekly schedule (`gameWeek`)       |
| `fetchPlayerGameLog(nhlId)`    | GET  | `/v1/player/{id}/game-log/now`     | Season game log (skater or goalie) |
| `fetchClubStats(team, season)` | GET  | `/v1/club-stats/{team}/{season}/2` | Team player stats                  |

- No auth required (public API)
- 100ms delay between sequential calls when bulk-fetching (rate-limit courtesy)
- Base URL hardcoded (stable public API)

---

## Data Sync Orchestration

### `src/server/services/data-sync.ts`

The only code that calls the API service wrappers. Four sync operations:

### `syncPlayers()` — Admin-triggered

1. Optionally call `triggerPlayerScrape()` to refresh upstream data
2. Call `fetchPlayers()` to get all players
3. Upsert into `players` table (match on `nhlId`)
4. Update `lastSyncedAt` on all upserted rows
5. Return sync result (count updated, timestamp)

### `syncInjuries()` — Admin-triggered

1. Call `triggerInjuryScrape()` to refresh upstream injury data
2. Call `fetchPlayers()` to get updated player data (injuries are embedded on player objects)
3. Upsert into `players` table (match on `nhlId`) — updates `injuryStatus` and `injuryDescription`
4. Update `lastSyncedAt` on all upserted rows

### `syncSchedule()` — Automated

1. Fetch current week's schedule via `fetchSchedule(date)`
2. Upsert into `games` table (match on `nhlGameId`)
3. Auto-generate weekly boundaries for all active pools:
   - Scan all season games
   - Bucket by Mon-Sun
   - `lockTime` = earliest `startTimeUtc` per week
   - Insert/update `weeklySchedules` — skip rows with `isOverridden = true`

### `syncLiveScoring()` — Automated, schedule-aware

Guard checks (short-circuit if no work needed):

1. **Time window**: Skip entirely outside 11:00 AM - 1:30 AM ET
2. **Schedule check**: Query `games` for today — any not "FINAL"/"OFF"?
3. If no active games → no-op

Sync logic:

1. Fetch `/v1/score/now`
2. Upsert game states (score, period, timeRemaining, gameState)
3. Upsert `goalEvents` (match on unique constraint)
4. Incrementally update `weeklyScores` for affected pools

### Nightly Reconciliation

Runs once after last game ends (or early morning):

1. Fetch game logs for all rostered players via `fetchPlayerGameLog(nhlId)`
2. For goalies: upsert into `goaltenderGameStats` (match on `nhlGameId + goaltenderNhlId`)
3. Cross-reference `goalEvents` against game logs to catch missed/corrected events
4. Rebuild `weeklyScores` summary table from `scoringEvents`
5. Log any discrepancies for admin review

### Staleness Tracking

Every sync updates `lastSyncedAt` on entity tables (`players`, `games`). Server functions expose staleness metadata so the UI can show "Player data last updated 3 hours ago" or similar indicators. If an API call fails, existing data stays in place — never cleared.

---

## Server Functions

### Admin Functions (`src/server/functions/admin.ts`)

| Function           | Access     | Description                                                   |
| ------------------ | ---------- | ------------------------------------------------------------- |
| `$syncPlayers()`   | Owner only | Triggers upstream scrape + syncs players into DB              |
| `$syncInjuries()`  | Owner only | Triggers upstream injury scrape + re-syncs player injury data |
| `$getSyncStatus()` | Owner only | Returns `lastSyncedAt` for players, schedule, scoring         |

### Pool Functions (extending `src/server/functions/pool.ts`)

| Function                                  | Access      | Description                                        |
| ----------------------------------------- | ----------- | -------------------------------------------------- |
| `$getPoolConfig(poolId)`                  | Pool member | Returns scoring rules, constraints, toggles        |
| `$getWeeklySchedule(poolId, weekNumber?)` | Pool member | Current or specified week with lock time and games |

These are read-only. Admin config editing functions are Phase 4 scope.

---

## Environment Configuration

Two new env vars added to `src/env/server.ts`:

```typescript
NHL_SALARY_API_URL: z.url(),
NHL_SALARY_API_KEY: z.string().min(1),
```

NHL-e API base URL is hardcoded (`https://api-web.nhle.com/v1`) — stable public API with no auth.

---

## Out of Scope (Deferred to Later Phases)

- **Roster management UI** (Phase 2)
- **Scoring engine execution** — the sync layer collects raw data; the scoring engine that processes it against pool rules is Phase 2
- **Live scoring polling scheduler** — the `syncLiveScoring()` function is built, but the cron/scheduler that calls it is Phase 4
- **Admin config editing UI** (Phase 4)
- **Email automation** (Phase 4)
- **Financial model admin UI** (Phase 3)

## Dependencies

- Drizzle ORM v0.45.1 (already installed)
- postgres v3.4.8 driver (already installed)
- Zod v4.3.6 (already installed)
- No new dependencies required
