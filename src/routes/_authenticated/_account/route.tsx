import { Outlet, createFileRoute } from "@tanstack/react-router";

import { NavBar } from "@/components/nav-bar";

export const Route = createFileRoute("/_authenticated/_account")({
  component: AccountLayout,
});

function AccountLayout() {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}
