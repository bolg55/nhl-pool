import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth/auth";
import { poolNameSchema } from "@/shared/schemas/pool-config";

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
