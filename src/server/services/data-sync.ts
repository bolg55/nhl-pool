// src/server/services/data-sync.ts
import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { organization } from "@/server/db/schema/auth.schema";
import { players, games, goalEvents, goaltenderGameStats } from "@/server/db/schema/players.schema";
import { weeklySchedules } from "@/server/db/schema/schedule.schema";
import {
  fetchPlayers as apiFetchPlayers,
  triggerPlayerScrape,
  triggerInjuryScrape,
} from "@/server/services/nhl-salary-api";
import {
  fetchScores as apiFetchScores,
  fetchSchedule as apiFetchSchedule,
  fetchPlayerGameLog,
  type NhleGoalieGameLog,
} from "@/server/services/nhle-api";

// ---------------------------------------------------------------------------
// syncPlayers
// ---------------------------------------------------------------------------
export async function syncPlayers(options?: { triggerScrape?: boolean }) {
  if (options?.triggerScrape) {
    await triggerPlayerScrape();
  }

  const apiPlayers = await apiFetchPlayers();
  const syncedAt = new Date();

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
        lastSyncedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: players.nhlId,
        set: {
          name: sql`excluded.name`,
          team: sql`excluded.team`,
          position: sql`excluded.position`,
          salary: sql`excluded.salary`,
          injuryStatus: sql`excluded.injury_status`,
          injuryDescription: sql`excluded.injury_description`,
          lastSyncedAt: syncedAt,
        },
      });
  }

  return { count: apiPlayers.length, syncedAt };
}

// ---------------------------------------------------------------------------
// syncInjuries
// ---------------------------------------------------------------------------
export async function syncInjuries() {
  await triggerInjuryScrape();
  return syncPlayers();
}

// ---------------------------------------------------------------------------
// syncSchedule
// ---------------------------------------------------------------------------
export async function syncSchedule(date: string) {
  const schedule = await apiFetchSchedule(date);
  const syncedAt = new Date();
  let gamesUpserted = 0;

  for (const day of schedule.gameWeek) {
    for (const g of day.games) {
      await db
        .insert(games)
        .values({
          nhlGameId: g.id,
          season: String(g.season),
          gameDate: g.gameDate,
          gameType: g.gameType,
          homeTeam: g.homeTeam.abbrev,
          awayTeam: g.awayTeam.abbrev,
          gameState: g.gameState,
          startTimeUtc: new Date(g.startTimeUTC),
          lastSyncedAt: syncedAt,
        })
        .onConflictDoUpdate({
          target: games.nhlGameId,
          set: {
            gameState: sql`excluded.game_state`,
            startTimeUtc: sql`excluded.start_time_utc`,
            lastSyncedAt: syncedAt,
          },
        });
      gamesUpserted++;
    }
  }

  await generateWeeklyBoundaries();

  return { gamesUpserted, syncedAt };
}

// ---------------------------------------------------------------------------
// generateWeeklyBoundaries (internal)
// ---------------------------------------------------------------------------
async function generateWeeklyBoundaries() {
  const pools = await db.select().from(organization);
  const allGames = await db.select().from(games).orderBy(games.gameDate);

  if (allGames.length === 0) return;

  // Bucket games into Mon–Sun weeks
  const weeks = new Map<number, { startDate: string; endDate: string; lockTime: Date }>();

  for (const game of allGames) {
    const d = new Date(game.gameDate + "T00:00:00Z");
    // getUTCDay: 0=Sun, 1=Mon. We want Monday-based weeks.
    const dayOfWeek = d.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(d);
    monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
    const mondayStr = monday.toISOString().slice(0, 10);

    // Week number: count weeks from the earliest Monday
    if (weeks.size === 0) {
      weeks.set(1, {
        startDate: mondayStr,
        endDate: sundayOf(monday),
        lockTime: game.startTimeUtc,
      });
    }

    // Find or create week
    let weekNumber: number | null = null;
    for (const [num, week] of weeks) {
      if (week.startDate === mondayStr) {
        weekNumber = num;
        // Update lockTime if this game is earlier
        if (game.startTimeUtc < week.lockTime) {
          week.lockTime = game.startTimeUtc;
        }
        break;
      }
    }

    if (weekNumber === null) {
      const newNum = weeks.size + 1;
      weeks.set(newNum, {
        startDate: mondayStr,
        endDate: sundayOf(monday),
        lockTime: game.startTimeUtc,
      });
    }
  }

  // Re-number weeks in chronological order
  const sortedWeeks = [...weeks.entries()].sort((a, b) =>
    a[1].startDate.localeCompare(b[1].startDate),
  );

  for (const pool of pools) {
    for (let i = 0; i < sortedWeeks.length; i++) {
      const weekNum = i + 1;
      const week = sortedWeeks[i]![1];

      // Skip overridden rows
      const existing = await db
        .select()
        .from(weeklySchedules)
        .where(and(eq(weeklySchedules.poolId, pool.id), eq(weeklySchedules.weekNumber, weekNum)))
        .limit(1);

      if (existing.length > 0 && existing[0]!.isOverridden) {
        continue;
      }

      await db
        .insert(weeklySchedules)
        .values({
          poolId: pool.id,
          weekNumber: weekNum,
          startDate: week.startDate,
          endDate: week.endDate,
          lockTime: week.lockTime,
        })
        .onConflictDoUpdate({
          target: [weeklySchedules.poolId, weeklySchedules.weekNumber],
          set: {
            startDate: sql`excluded.start_date`,
            endDate: sql`excluded.end_date`,
            lockTime: sql`excluded.lock_time`,
          },
          setWhere: eq(weeklySchedules.isOverridden, false),
        });
    }
  }
}

function sundayOf(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return sunday.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// _isWithinGameWindow
// ---------------------------------------------------------------------------
export function _isWithinGameWindow(now: Date): boolean {
  const utcHour = now.getUTCHours();
  // Game window: 11am–1:30am ET → UTC 15:00–07:00
  return utcHour >= 15 || utcHour < 7;
}

// ---------------------------------------------------------------------------
// syncLiveScoring
// ---------------------------------------------------------------------------
export async function syncLiveScoring(now?: Date) {
  const currentTime = now ?? new Date();

  // Guard 1: outside game window
  if (!_isWithinGameWindow(currentTime)) {
    return { skipped: true, gamesUpdated: 0, goalsUpserted: 0, syncedAt: currentTime };
  }

  // Guard 2: all games today are final or off
  const todayStr = currentTime.toISOString().slice(0, 10);
  const todayGames = await db.select().from(games).where(eq(games.gameDate, todayStr));

  if (
    todayGames.length > 0 &&
    todayGames.every((g) => g.gameState === "FINAL" || g.gameState === "OFF")
  ) {
    return { skipped: true, gamesUpdated: 0, goalsUpserted: 0, syncedAt: currentTime };
  }

  const scores = await apiFetchScores();
  const syncedAt = new Date();
  let gamesUpdated = 0;
  let goalsUpserted = 0;

  for (const g of scores.games) {
    // Upsert game state
    await db
      .insert(games)
      .values({
        nhlGameId: g.id,
        season: String(g.season),
        gameDate: g.gameDate,
        gameType: g.gameType,
        homeTeam: g.homeTeam.abbrev,
        awayTeam: g.awayTeam.abbrev,
        homeScore: g.homeTeam.score,
        awayScore: g.awayTeam.score,
        gameState: g.gameState,
        startTimeUtc: new Date(g.startTimeUTC),
        period: g.period ?? null,
        timeRemaining: g.clock?.timeRemaining ?? null,
        lastSyncedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: games.nhlGameId,
        set: {
          homeScore: sql`excluded.home_score`,
          awayScore: sql`excluded.away_score`,
          gameState: sql`excluded.game_state`,
          period: sql`excluded.period`,
          timeRemaining: sql`excluded.time_remaining`,
          lastSyncedAt: syncedAt,
        },
      });
    gamesUpdated++;

    // Upsert goal events
    if (g.goals && g.goals.length > 0) {
      // Look up game UUID
      const gameRows = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.nhlGameId, g.id))
        .limit(1);

      if (gameRows.length > 0) {
        const gameId = gameRows[0]!.id;

        for (const goal of g.goals) {
          await db
            .insert(goalEvents)
            .values({
              gameId,
              nhlGameId: g.id,
              scorerNhlId: goal.playerId,
              period: goal.period,
              timeInPeriod: goal.timeInPeriod,
              strength: goal.strength,
              goalModifier: goal.goalModifier,
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

  // TODO: weeklyScores update deferred to Phase 2
  return { skipped: false, gamesUpdated, goalsUpserted, syncedAt };
}

// ---------------------------------------------------------------------------
// syncGoaltenderStats
// ---------------------------------------------------------------------------
export async function syncGoaltenderStats(goaltenderNhlIds: number[]) {
  let statsUpserted = 0;

  for (let i = 0; i < goaltenderNhlIds.length; i++) {
    const nhlId = goaltenderNhlIds[i]!;
    const response = await fetchPlayerGameLog(nhlId);

    for (const entry of response.gameLog) {
      // Filter for goalie entries (check for shotsAgainst field)
      if (!("shotsAgainst" in entry)) continue;
      const goalieEntry = entry as NhleGoalieGameLog;

      // Look up game UUID
      const gameRows = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.nhlGameId, goalieEntry.gameId))
        .limit(1);

      if (gameRows.length === 0) continue;

      await db
        .insert(goaltenderGameStats)
        .values({
          gameId: gameRows[0]!.id,
          nhlGameId: goalieEntry.gameId,
          goaltenderNhlId: nhlId,
          decision: goalieEntry.decision || null,
          shotsAgainst: goalieEntry.shotsAgainst,
          goalsAgainst: goalieEntry.goalsAgainst,
          savePctg: goalieEntry.savePctg,
          shutout: goalieEntry.shutouts > 0,
          toi: goalieEntry.toi,
        })
        .onConflictDoUpdate({
          target: [goaltenderGameStats.nhlGameId, goaltenderGameStats.goaltenderNhlId],
          set: {
            decision: sql`excluded.decision`,
            shotsAgainst: sql`excluded.shots_against`,
            goalsAgainst: sql`excluded.goals_against`,
            savePctg: sql`excluded.save_pctg`,
            shutout: sql`excluded.shutout`,
            toi: sql`excluded.toi`,
          },
        });
      statsUpserted++;
    }

    // Rate limit courtesy: 100ms delay between players
    if (i < goaltenderNhlIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { statsUpserted };
}
