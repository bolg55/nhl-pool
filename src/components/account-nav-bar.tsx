// src/components/account-nav-bar.tsx
import { RiLogoutBoxLine, RiSettingsLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

import { authClient } from "@/lib/auth/auth-client";
import { authQueryOptions } from "@/lib/auth/queries";
import { cn } from "@/lib/utils";

const baseTrigger =
  "relative inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0";

const activeTrigger = "text-foreground after:opacity-100";

export function AccountNavBar() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onResponse: async () => {
          queryClient.setQueryData(authQueryOptions().queryKey, null);
          await router.invalidate();
        },
      },
    });
  };

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden border-b bg-background md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-semibold">NHL Pool</span>
          <div className="flex items-center gap-1">
            <Link
              to="/settings"
              className={cn(
                baseTrigger,
                "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity",
              )}
              activeProps={{ className: cn(baseTrigger, activeTrigger) }}
            >
              <RiSettingsLine className="size-4" />
              Settings
            </Link>
            <button onClick={handleSignOut} className={baseTrigger} type="button">
              <RiLogoutBoxLine className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile: top bar (not bottom — minimal nav doesn't need bottom tabs) */}
      <nav className="border-b bg-background md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold">NHL Pool</span>
          <div className="flex items-center gap-3">
            <Link to="/settings" className="text-foreground/60 hover:text-foreground">
              <RiSettingsLine className="size-5" />
            </Link>
            <button
              onClick={handleSignOut}
              className="text-foreground/60 hover:text-foreground"
              type="button"
            >
              <RiLogoutBoxLine className="size-5" />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
