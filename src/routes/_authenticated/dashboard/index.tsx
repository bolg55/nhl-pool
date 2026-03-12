import { createFileRoute } from "@tanstack/react-router";

import { SignOutButton } from "@/components/sign-out-button";
import { useAuthSuspense } from "@/lib/auth/hooks";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuthSuspense();

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Welcome, {user?.email ?? "player"}!</p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
