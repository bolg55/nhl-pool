// src/server/functions/pool-context.ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";

const slugSchema = z.object({
  slug: z.string().min(1),
});

export const $getPoolBySlug = createServerFn({ method: "POST" })
  .inputValidator(slugSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    // List user's orgs and find the one matching the slug
    const orgs = await auth.api.listOrganizations({
      headers: request.headers,
    });

    const pool = orgs.find((org) => org.slug === data.slug);
    if (!pool) throw new Error("Pool not found");

    // Get the full org to find the user's role
    const fullOrg = await auth.api.getFullOrganization({
      query: { organizationId: pool.id },
      headers: request.headers,
    });

    const userMember = fullOrg?.members?.find((m) => m.userId === session.user.id);

    if (!userMember) throw new Error("Not a member of this pool");

    // Sync activeOrganizationId so Better Auth's org-scoped API calls work.
    // This is idempotent — only calls if the active org doesn't match.
    if (session.session.activeOrganizationId !== pool.id) {
      await auth.api.setActiveOrganization({
        body: { organizationId: pool.id },
        headers: request.headers,
      });
    }

    return {
      pool: { id: pool.id, name: pool.name, slug: pool.slug },
      role: userMember.role as "owner" | "member",
    };
  });
