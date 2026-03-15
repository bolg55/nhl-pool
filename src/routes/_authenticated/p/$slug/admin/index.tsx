import { createFileRoute, redirect } from "@tanstack/react-router";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/p/$slug/admin/")({
  beforeLoad: ({ context, params }) => {
    if (context.role !== "owner") {
      throw redirect({
        to: "/p/$slug/dashboard",
        params: { slug: params.slug },
      });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const { pool } = Route.useRouteContext();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Pool Settings</h1>
      <p className="mt-1 text-muted-foreground">{pool.name}</p>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Pool Configuration</CardTitle>
            <CardDescription>
              Scoring rules, roster constraints, and other settings will be configured here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
