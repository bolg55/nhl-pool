import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { NavBar } from "@/components/nav-bar";
import { $getPoolBySlug } from "@/server/functions/pool-context";

export const Route = createFileRoute("/_authenticated/p/$slug")({
  beforeLoad: async ({ params }) => {
    try {
      const poolContext = await $getPoolBySlug({ data: { slug: params.slug } });
      return poolContext;
    } catch (error) {
      if (
        error instanceof Error &&
        ["Pool not found", "Not a member of this pool", "Unauthorized"].includes(error.message)
      ) {
        throw redirect({ to: "/dashboard" });
      }
      throw error;
    }
  },
  component: PoolLayout,
});

function PoolLayout() {
  const { pool, role } = Route.useRouteContext();

  return (
    <>
      <NavBar pool={{ poolName: pool.name, slug: pool.slug, role }} />
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>
    </>
  );
}
