import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AccountNavBar } from "@/components/account-nav-bar";

export const Route = createFileRoute("/_authenticated/_account")({
  component: AccountLayout,
});

function AccountLayout() {
  return (
    <>
      <AccountNavBar />
      <Outlet />
    </>
  );
}
