import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authQueryOptions } from "@/lib/auth/queries";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(authQueryOptions());

    if (!user) {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: () => <Outlet />,
});
