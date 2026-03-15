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
