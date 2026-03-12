import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/roster/")({
  component: () => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Roster</h1>
        <p className="mt-2 text-muted-foreground">Coming soon</p>
      </div>
    </div>
  ),
});
