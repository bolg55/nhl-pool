// src/components/pool-nav-bar.tsx
import {
  RiAdminLine,
  RiDashboardLine,
  RiGroupLine,
  RiLiveLine,
  RiMoreLine,
  RiSettingsLine,
  RiTrophyLine,
} from "@remixicon/react";
import { Link, useParams } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

const baseTrigger =
  "relative inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0";

const activeTrigger = "text-foreground after:opacity-100";

interface PoolNavBarProps {
  poolName: string;
  role: "owner" | "member";
}

export function PoolNavBar({ poolName, role }: PoolNavBarProps) {
  const { slug } = useParams({ strict: false });

  const poolTabs = [
    { to: "/p/$slug/dashboard" as const, label: "Dashboard", icon: RiDashboardLine },
    { to: "/p/$slug/roster" as const, label: "Roster", icon: RiGroupLine },
    { to: "/p/$slug/standings" as const, label: "Standings", icon: RiTrophyLine },
    { to: "/p/$slug/live" as const, label: "Live", icon: RiLiveLine },
    ...(role === "owner"
      ? [{ to: "/p/$slug/admin" as const, label: "Admin", icon: RiAdminLine }]
      : []),
  ];

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden border-b bg-background md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold">NHL Pool</span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {poolName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {poolTabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                params={{ slug: slug! }}
                className={cn(
                  baseTrigger,
                  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity",
                )}
                activeProps={{ className: cn(baseTrigger, activeTrigger) }}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </Link>
            ))}
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
          </div>
        </div>
      </nav>

      {/* Mobile: bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background md:hidden">
        <div className="flex items-center justify-around">
          {poolTabs.slice(0, 4).map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ slug: slug! }}
              className={cn(
                baseTrigger,
                "flex-1 flex-col gap-1 py-2 text-xs",
                "after:absolute after:inset-x-2 after:-top-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity",
              )}
              activeProps={{
                className: cn(baseTrigger, activeTrigger, "flex-1 flex-col gap-1 py-2 text-xs"),
              }}
            >
              <tab.icon className="size-5" />
              {tab.label}
            </Link>
          ))}
          <Link
            to="/settings"
            className={cn(
              baseTrigger,
              "flex-1 flex-col gap-1 py-2 text-xs",
              "after:absolute after:inset-x-2 after:-top-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity",
            )}
            activeProps={{
              className: cn(baseTrigger, activeTrigger, "flex-1 flex-col gap-1 py-2 text-xs"),
            }}
          >
            <RiMoreLine className="size-5" />
            More
          </Link>
        </div>
      </nav>
    </>
  );
}
