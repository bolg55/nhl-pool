import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { db } from "@/server/db";
import { games } from "@/server/db/schema/players.schema";
import { weeklySchedules } from "@/server/db/schema/schedule.schema";
import { poolConfig } from "@/server/db/schema/scoring.schema";
import { poolNameSchema } from "@/shared/schemas/pool-config";

async function requirePoolMember(poolId: string) {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Unauthorized");
  const orgs = await auth.api.listOrganizations({ headers: request.headers });
  const pool = orgs.find((org) => org.id === poolId);
  if (!pool) throw new Error("Not a member of this pool");
  return session;
}

export const $createPool = createServerFn({ method: "POST" })
  .inputValidator(poolNameSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const org = await auth.api.createOrganization({
      body: { name: data.name, slug },
      headers: request.headers,
    });

    return org;
  });

export const $listUserPools = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Unauthorized");

  const orgs = await auth.api.listOrganizations({
    headers: request.headers,
  });

  return orgs;
});

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

    const weekGames = await db
      .select()
      .from(games)
      .where(
        and(sql`${games.gameDate} >= ${week.startDate}`, sql`${games.gameDate} <= ${week.endDate}`),
      )
      .orderBy(games.startTimeUtc);

    return { ...week, games: weekGames };
  });
