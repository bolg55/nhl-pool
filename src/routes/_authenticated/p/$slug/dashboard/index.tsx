import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/p/$slug/dashboard/")({
  component: PoolDashboardPage,
});

function PoolDashboardPage() {
  const { pool } = Route.useRouteContext();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">{pool.name}</p>
      <div className="mt-8 text-center text-muted-foreground">
        Pool dashboard coming soon — weekly winner, standings preview, lock countdown.
      </div>
    </div>
  );
}
