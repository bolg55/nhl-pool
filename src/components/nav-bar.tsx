import { RiDashboardLine, RiGroupLine, RiSettingsLine, RiTrophyLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

const tabs = [
  { to: "/dashboard", label: "Dashboard", icon: RiDashboardLine },
  { to: "/roster", label: "Roster", icon: RiGroupLine },
  { to: "/standings", label: "Standings", icon: RiTrophyLine },
  { to: "/settings", label: "Settings", icon: RiSettingsLine },
] as const;

const baseTrigger =
  "relative inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0";

const activeTrigger = "text-foreground after:opacity-100";

export function NavBar() {
  return (
    <>
      {/* Desktop: top bar — matches shadcn tabs line variant */}
      <nav className="hidden border-b bg-background md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
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
        </div>
      </nav>

      {/* Mobile: bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background md:hidden">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
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
        </div>
      </nav>
    </>
  );
}
