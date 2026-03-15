import {
  RiAdminLine,
  RiDashboardLine,
  RiGroupLine,
  RiLiveLine,
  RiLogoutBoxLine,
  RiMoreLine,
  RiSettingsLine,
  RiTrophyLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";

import { authClient } from "@/lib/auth/auth-client";
import { authQueryOptions } from "@/lib/auth/queries";
import { cn } from "@/lib/utils";

const baseTrigger =
  "relative inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0";

const activeTrigger = "text-foreground after:opacity-100";

const desktopUnderline =
  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity";

const mobileTab = "flex-1 flex-col gap-1 py-2 text-xs";

const mobileOverline =
  "after:absolute after:inset-x-2 after:-top-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity";

interface PoolContext {
  poolName: string;
  slug: string;
  role: "owner" | "member";
}

interface NavBarProps {
  pool?: PoolContext;
}

export function NavBar({ pool }: NavBarProps) {
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

  const poolTabs = pool
    ? [
        { to: "/p/$slug/dashboard" as const, label: "Dashboard", icon: RiDashboardLine },
        { to: "/p/$slug/roster" as const, label: "Roster", icon: RiGroupLine },
        { to: "/p/$slug/standings" as const, label: "Standings", icon: RiTrophyLine },
        { to: "/p/$slug/live" as const, label: "Live", icon: RiLiveLine },
        ...(pool.role === "owner"
          ? [{ to: "/p/$slug/admin" as const, label: "Admin", icon: RiAdminLine }]
          : []),
        { to: "/p/$slug/profile" as const, label: "Profile", icon: RiSettingsLine },
      ]
    : [];

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden border-b bg-background md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-lg font-semibold hover:opacity-80">
              NHL Pool
            </Link>
            {pool && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {pool.poolName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {pool ? (
              poolTabs.map((tab) => (
                <Link
                  key={tab.to}
                  to={tab.to}
                  params={{ slug: pool.slug }}
                  className={cn(baseTrigger, desktopUnderline)}
                  activeProps={{ className: cn(baseTrigger, activeTrigger) }}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </Link>
              ))
            ) : (
              <Link
                to="/profile"
                className={cn(baseTrigger, desktopUnderline)}
                activeProps={{ className: cn(baseTrigger, activeTrigger) }}
              >
                <RiSettingsLine className="size-4" />
                Profile
              </Link>
            )}
            <button onClick={handleSignOut} className={baseTrigger} type="button">
              <RiLogoutBoxLine className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile: bottom bar (pool tabs) or top bar (no pool) */}
      {pool ? (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background md:hidden">
          <div className="flex items-center justify-around">
            {poolTabs.slice(0, 4).map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                params={{ slug: pool.slug }}
                className={cn(baseTrigger, mobileTab, mobileOverline)}
                activeProps={{ className: cn(baseTrigger, activeTrigger, mobileTab) }}
              >
                <tab.icon className="size-5" />
                {tab.label}
              </Link>
            ))}
            <Link
              to="/p/$slug/profile"
              params={{ slug: pool.slug }}
              className={cn(baseTrigger, mobileTab, mobileOverline)}
              activeProps={{ className: cn(baseTrigger, activeTrigger, mobileTab) }}
            >
              <RiMoreLine className="size-5" />
              More
            </Link>
          </div>
        </nav>
      ) : (
        <nav className="border-b bg-background md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-lg font-semibold">NHL Pool</span>
            <div className="flex items-center gap-3">
              <Link to="/profile" className="text-foreground/60 hover:text-foreground">
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
      )}
    </>
  );
}
