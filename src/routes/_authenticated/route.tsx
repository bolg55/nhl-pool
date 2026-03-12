import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { NavBar } from "@/components/nav-bar";
import { authQueryOptions } from "@/lib/auth/queries";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(authQueryOptions());

    if (!user) {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <>
      <NavBar />
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>
    </>
  );
}
