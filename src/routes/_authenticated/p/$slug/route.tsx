import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { PoolNavBar } from "@/components/pool-nav-bar";
import { $getPoolBySlug } from "@/server/functions/pool-context";

export const Route = createFileRoute("/_authenticated/p/$slug")({
  beforeLoad: async ({ params }) => {
    try {
      const poolContext = await $getPoolBySlug({ data: { slug: params.slug } });
      return poolContext;
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PoolLayout,
});

function PoolLayout() {
  const { pool, role } = Route.useRouteContext();

  return (
    <>
      <PoolNavBar poolName={pool.name} role={role} />
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>
    </>
  );
}
