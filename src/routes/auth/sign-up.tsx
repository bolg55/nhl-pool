import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/sign-up")({
  beforeLoad: () => {
    // OTP flow auto-creates accounts — no separate sign-up needed.
    // SIGN_UP view shows password fields even with credentials={false}.
    throw redirect({ to: "/auth/sign-in" });
  },
});
