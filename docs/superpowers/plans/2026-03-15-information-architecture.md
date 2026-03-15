# Information Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure routes and navigation from flat to slug-based pool context (`/p/$slug/...`), with adaptive nav that shows pool tabs only when the user is in a pool.

**Architecture:** TanStack Router layout routes provide two shells: `_authenticated/route.tsx` (minimal account shell) and `_authenticated/p/$slug/route.tsx` (pool context loader + pool nav). The pool layout validates membership via a new `$getPoolBySlug` server function and passes pool context to all child routes.

**Tech Stack:** TanStack Start, TanStack Router (file-based), Better Auth (organization plugin), React 19, shadcn/ui, Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-03-15-information-architecture-design.md`

---

## File Map

### New Files

| File                                                    | Responsibility                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/server/functions/pool-context.ts`                  | `$getPoolBySlug` server function — resolves slug to org, validates membership, returns `{ pool, role }` |
| `src/routes/_authenticated/p/$slug/route.tsx`           | Pool layout route — loader calls `$getPoolBySlug`, renders pool nav + `<Outlet />`                      |
| `src/routes/_authenticated/p/$slug/dashboard/index.tsx` | Pool-scoped dashboard (placeholder)                                                                     |
| `src/routes/_authenticated/p/$slug/roster/index.tsx`    | Pool-scoped roster (placeholder)                                                                        |
| `src/routes/_authenticated/p/$slug/standings/index.tsx` | Pool-scoped standings (placeholder)                                                                     |
| `src/routes/_authenticated/p/$slug/live/index.tsx`      | Pool-scoped live scoring (placeholder)                                                                  |
| `src/routes/_authenticated/p/$slug/admin/index.tsx`     | Pool admin overview (owner-only, uses pool context)                                                     |
| `src/components/pool-nav-bar.tsx`                       | Pool-scoped navigation component (Dashboard, Roster, Standings, Live, Admin if owner)                   |
| `src/components/account-nav-bar.tsx`                    | Minimal account navigation (logo + settings + sign out)                                                 |

### Modified Files

| File                                            | Change                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `src/routes/_authenticated/route.tsx`           | Replace `<NavBar />` with `<AccountNavBar />`                               |
| `src/routes/_authenticated/dashboard/index.tsx` | Add auto-redirect for single-pool users, simplify to pool list + create CTA |

### Deleted Files

| File                                            | Reason                                                   |
| ----------------------------------------------- | -------------------------------------------------------- |
| `src/routes/_authenticated/roster/index.tsx`    | Replaced by `/p/$slug/roster`                            |
| `src/routes/_authenticated/standings/index.tsx` | Replaced by `/p/$slug/standings`                         |
| `src/routes/_authenticated/admin/index.tsx`     | Replaced by `/p/$slug/admin`                             |
| `src/components/nav-bar.tsx`                    | Replaced by `pool-nav-bar.tsx` and `account-nav-bar.tsx` |

### Modified Test Files

| File                              | Change                                                    |
| --------------------------------- | --------------------------------------------------------- |
| `tests/e2e/pool-creation.spec.ts` | Update URLs, assertions, and flow for new route structure |

---

## Chunk 1: Pool Context Server Function

### Task 1: Create `$getPoolBySlug` server function

**Files:**

- Create: `src/server/functions/pool-context.ts`

- [ ] **Step 1: Create the server function file**

```ts
// src/server/functions/pool-context.ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";

const slugSchema = z.object({
  slug: z.string().min(1),
});

export const $getPoolBySlug = createServerFn({ method: "POST" })
  .inputValidator(slugSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    // List user's orgs and find the one matching the slug
    const orgs = await auth.api.listOrganizations({
      headers: request.headers,
    });

    const pool = orgs.find((org) => org.slug === data.slug);
    if (!pool) throw new Error("Pool not found");

    // Get the full org to find the user's role
    const fullOrg = await auth.api.getFullOrganization({
      query: { organizationId: pool.id },
      headers: request.headers,
    });

    const userMember = fullOrg?.members?.find((m) => m.userId === session.user.id);

    if (!userMember) throw new Error("Not a member of this pool");

    // Sync activeOrganizationId so Better Auth's org-scoped API calls work.
    // This is idempotent — only calls if the active org doesn't match.
    if (session.session.activeOrganizationId !== pool.id) {
      await auth.api.setActiveOrganization({
        body: { organizationId: pool.id },
        headers: request.headers,
      });
    }

    return {
      pool: { id: pool.id, name: pool.name, slug: pool.slug },
      role: userMember.role as "owner" | "member",
    };
  });
```

- [ ] **Step 2: Verify the dev server still compiles**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `pool-context.ts`

- [ ] **Step 3: Commit**

```bash
git add src/server/functions/pool-context.ts
git commit -m "feat: add \$getPoolBySlug server function for pool context resolution"
```

---

## Chunk 2: Navigation Components

### Task 2: Create account nav bar

**Files:**

- Create: `src/components/account-nav-bar.tsx`

- [ ] **Step 1: Create the account nav bar component**

This is the minimal nav shown when a user has no pool context — logo, settings link, sign out.

```tsx
// src/components/account-nav-bar.tsx
import { RiLogoutBoxLine, RiSettingsLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/account-nav-bar.tsx
git commit -m "feat: add AccountNavBar for minimal account-level navigation"
```

### Task 3: Create pool nav bar

**Files:**

- Create: `src/components/pool-nav-bar.tsx`

- [ ] **Step 1: Create the pool nav bar component**

This is the full pool-scoped nav with Dashboard, Roster, Standings, Live, and conditionally Admin.

```tsx
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/pool-nav-bar.tsx
git commit -m "feat: add PoolNavBar for pool-scoped navigation with role-based Admin tab"
```

---

## Chunk 3: Pool Layout Route & Placeholder Pages

### Task 4: Create pool layout route

**Files:**

- Create: `src/routes/_authenticated/p/$slug/route.tsx`

- [ ] **Step 1: Create the directory structure and pool layout route**

Run: `mkdir -p /home/kellen/dev/nhl-pool/src/routes/_authenticated/p/\$slug`

```tsx
// src/routes/_authenticated/p/$slug/route.tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { PoolNavBar } from "@/components/pool-nav-bar";
import { $getPoolBySlug } from "@/server/functions/pool-context";

export const Route = createFileRoute("/_authenticated/p/$slug")({
  beforeLoad: async ({ params }) => {
    try {
      const poolContext = await $getPoolBySlug({ data: { slug: params.slug } });
      // Return pool context so child routes can access via useRouteContext()
      return poolContext;
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PoolLayout,
});

function PoolLayout() {
  const { pool, role } = Route.useRouteContext();

  return (
    <>
      <PoolNavBar poolName={pool.name} role={role} />
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/p/
git commit -m "feat: add pool layout route with membership validation and pool nav"
```

### Task 5: Create pool-scoped placeholder pages

**Files:**

- Create: `src/routes/_authenticated/p/$slug/dashboard/index.tsx`
- Create: `src/routes/_authenticated/p/$slug/roster/index.tsx`
- Create: `src/routes/_authenticated/p/$slug/standings/index.tsx`
- Create: `src/routes/_authenticated/p/$slug/live/index.tsx`

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p /home/kellen/dev/nhl-pool/src/routes/_authenticated/p/\$slug/{dashboard,roster,standings,live}`

- [ ] **Step 2: Create pool dashboard page**

```tsx
// src/routes/_authenticated/p/$slug/dashboard/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/p/$slug/dashboard/")({
  component: PoolDashboardPage,
});

function PoolDashboardPage() {
  const { pool } = Route.useRouteContext();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">{pool.name}</p>
      <div className="mt-8 text-center text-muted-foreground">
        Pool dashboard coming soon — weekly winner, standings preview, lock countdown.
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create roster, standings, and live placeholder pages**

```tsx
// src/routes/_authenticated/p/$slug/roster/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/p/$slug/roster/")({
  component: () => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Roster</h1>
        <p className="mt-2 text-muted-foreground">Coming soon</p>
      </div>
    </div>
  ),
});
```

```tsx
// src/routes/_authenticated/p/$slug/standings/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/p/$slug/standings/")({
  component: () => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Standings</h1>
        <p className="mt-2 text-muted-foreground">Coming soon</p>
      </div>
    </div>
  ),
});
```

```tsx
// src/routes/_authenticated/p/$slug/live/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/p/$slug/live/")({
  component: () => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Live Scoring</h1>
        <p className="mt-2 text-muted-foreground">Coming soon</p>
      </div>
    </div>
  ),
});
```

- [ ] **Step 4: Verify all files compile**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/p/\$slug/dashboard/ src/routes/_authenticated/p/\$slug/roster/ src/routes/_authenticated/p/\$slug/standings/ src/routes/_authenticated/p/\$slug/live/
git commit -m "feat: add pool-scoped placeholder pages (dashboard, roster, standings, live)"
```

### Task 6: Create pool admin page

**Files:**

- Create: `src/routes/_authenticated/p/$slug/admin/index.tsx`

- [ ] **Step 1: Create admin directory and page**

Run: `mkdir -p /home/kellen/dev/nhl-pool/src/routes/_authenticated/p/\$slug/admin`

```tsx
// src/routes/_authenticated/p/$slug/admin/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/p/$slug/admin/")({
  beforeLoad: ({ context, params }) => {
    // Pool layout's beforeLoad already validated membership and set context.
    // Gate admin access to owners only.
    if (context.role !== "owner") {
      throw redirect({
        to: "/p/$slug/dashboard",
        params: { slug: params.slug },
      });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const { pool } = Route.useRouteContext();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Pool Settings</h1>
      <p className="mt-1 text-muted-foreground">{pool.name}</p>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Pool Configuration</CardTitle>
            <CardDescription>
              Scoring rules, roster constraints, and other settings will be configured here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/p/\$slug/admin/
git commit -m "feat: add pool admin page with owner role check under /p/\$slug/admin"
```

---

## Chunk 4: Modify Existing Routes

### Task 7: Update authenticated layout to use account nav bar

**Files:**

- Modify: `src/routes/_authenticated/route.tsx`

- [ ] **Step 1: Replace NavBar with AccountNavBar**

In `src/routes/_authenticated/route.tsx`, replace the import and usage:

```tsx
// src/routes/_authenticated/route.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AccountNavBar } from "@/components/account-nav-bar";
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
      <AccountNavBar />
      <Outlet />
    </>
  );
}
```

Note: Remove the `pb-16 md:pb-0` wrapper div — the account nav doesn't use a fixed bottom bar, so no padding is needed. The pool layout route handles its own bottom padding.

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/route.tsx
git commit -m "refactor: replace NavBar with AccountNavBar in authenticated layout"
```

### Task 8: Update account dashboard with auto-redirect

**Files:**

- Modify: `src/routes/_authenticated/dashboard/index.tsx`

- [ ] **Step 1: Add auto-redirect for single-pool users and pool card navigation**

Update the dashboard to redirect users with exactly one pool to `/p/$slug/dashboard`, and make pool cards clickable links to their pool dashboard.

Note: The existing `authClient.organization.setActive()` call is intentionally removed from `onSuccess`. The pool layout's `beforeLoad` now handles syncing `activeOrganizationId` when the user navigates to `/p/$slug/...`, so setting it eagerly on pool creation is no longer needed.

```tsx
// src/routes/_authenticated/dashboard/index.tsx
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthSuspense } from "@/lib/auth/hooks";
import { $createPool, $listUserPools } from "@/server/functions/pool";

const poolNameValidator = z
  .string()
  .trim()
  .min(3, "Pool name must be at least 3 characters")
  .max(50, "Pool name must be at most 50 characters");

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuthSuspense();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pools, isPending: poolsLoading } = useQuery({
    queryKey: ["pools"],
    queryFn: () => $listUserPools(),
  });

  // Auto-redirect: single pool → go straight to pool dashboard
  useEffect(() => {
    if (pools && pools.length === 1) {
      navigate({
        to: "/p/$slug/dashboard",
        params: { slug: pools[0].slug },
        replace: true,
      });
    }
  }, [pools, navigate]);

  const createPoolMutation = useMutation({
    mutationFn: (name: string) => $createPool({ data: { name } }),
    onSuccess: async (org) => {
      queryClient.invalidateQueries({ queryKey: ["pools"] });
      form.reset();
      toast.success(`Pool "${org.name}" created!`);
      // Navigate to the new pool's dashboard
      navigate({
        to: "/p/$slug/dashboard",
        params: { slug: org.slug },
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create pool");
    },
  });

  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      createPoolMutation.mutate(value.name);
    },
  });

  const hasPools = pools && pools.length > 0;

  // If single pool, we're redirecting — show nothing to avoid flash
  if (pools && pools.length === 1) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">{hasPools ? "Your Pools" : "Welcome to NHL Pool"}</h1>
      <p className="mt-1 text-muted-foreground">
        {hasPools
          ? `Welcome back, ${user?.name || user?.email}!`
          : "Create a pool to get started, or wait for an invite from your pool admin."}
      </p>

      <div className="mt-8">
        {poolsLoading ? (
          <p className="text-muted-foreground">Loading pools...</p>
        ) : hasPools ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {pools.map((pool) => (
                <Link key={pool.id} to="/p/$slug/dashboard" params={{ slug: pool.slug }}>
                  <Card className="transition-colors hover:border-foreground/20">
                    <CardHeader>
                      <CardTitle>{pool.name}</CardTitle>
                      <CardDescription>{pool.slug}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Create Another Pool</CardTitle>
              </CardHeader>
              <CardContent>
                <CreatePoolForm form={form} isPending={createPoolMutation.isPending} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="mx-auto max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Create Your First Pool</CardTitle>
              <CardDescription>
                Get started by creating a hockey pool for your group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreatePoolForm form={form} isPending={createPoolMutation.isPending} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CreatePoolForm({
  form,
  isPending,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  isPending: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <form.Field
        name="name"
        validators={{
          onBlur: poolNameValidator,
        }}
      >
        {(field: {
          state: {
            value: string;
            meta: { isTouched: boolean; errors: string[] };
          };
          handleBlur: () => void;
          handleChange: (value: string) => void;
        }) => (
          <div className="space-y-1.5">
            <Label htmlFor="pool-name">Pool Name</Label>
            <Input
              id="pool-name"
              placeholder="e.g. Office Hockey Pool"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors
                  .map((e: string | { message: string }) => (typeof e === "string" ? e : e.message))
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Pool"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/dashboard/index.tsx
git commit -m "feat: add auto-redirect for single-pool users, pool cards link to pool dashboard"
```

---

## Chunk 5: Delete Old Routes & Nav

### Task 9: Delete old flat routes and nav bar

**Files:**

- Delete: `src/routes/_authenticated/roster/index.tsx`
- Delete: `src/routes/_authenticated/standings/index.tsx`
- Delete: `src/routes/_authenticated/admin/index.tsx`
- Delete: `src/components/nav-bar.tsx`

- [ ] **Step 1: Remove old files**

```bash
rm src/routes/_authenticated/roster/index.tsx
rm src/routes/_authenticated/standings/index.tsx
rm src/routes/_authenticated/admin/index.tsx
rm src/components/nav-bar.tsx
```

- [ ] **Step 2: Remove empty directories**

```bash
rmdir src/routes/_authenticated/roster
rmdir src/routes/_authenticated/standings
rmdir src/routes/_authenticated/admin
```

- [ ] **Step 3: Verify nothing imports the deleted files**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (the old `nav-bar.tsx` import was already replaced in Task 7)

- [ ] **Step 4: Commit**

```bash
git add -u src/routes/_authenticated/roster/ src/routes/_authenticated/standings/ src/routes/_authenticated/admin/ src/components/nav-bar.tsx
git commit -m "refactor: remove old flat routes (roster, standings, admin) and nav-bar component"
```

---

## Chunk 6: Regenerate Route Tree & Manual Test

### Task 10: Regenerate route tree and verify dev server

- [ ] **Step 1: Start dev server to trigger route tree regeneration**

Run: `cd /home/kellen/dev/nhl-pool && npx vite --force 2>&1 | head -30`

TanStack Router's Vite plugin auto-generates `src/routeTree.gen.ts` on file changes. Starting the dev server will pick up the new `/p/$slug/...` routes and remove the deleted flat routes.

Expected: Dev server starts, `routeTree.gen.ts` regenerates with the new pool routes.

- [ ] **Step 2: Verify route tree includes new routes**

Check that `routeTree.gen.ts` contains entries for:

- `/_authenticated/p/$slug` (layout)
- `/_authenticated/p/$slug/dashboard/`
- `/_authenticated/p/$slug/roster/`
- `/_authenticated/p/$slug/standings/`
- `/_authenticated/p/$slug/live/`
- `/_authenticated/p/$slug/admin/`

And does NOT contain:

- `/_authenticated/roster/`
- `/_authenticated/standings/`
- `/_authenticated/admin/`

- [ ] **Step 3: Manual smoke test in browser**

1. Open `http://localhost:3000/dashboard` — should show account dashboard with minimal nav
2. Create a pool (if none exists) — should redirect to `/p/<slug>/dashboard`
3. Verify pool nav shows Dashboard, Roster, Standings, Live tabs
4. Click each pool tab — should navigate to `/p/<slug>/roster`, etc.
5. Navigate to `/settings` — should show settings page with account nav
6. Navigate to `/p/<slug>/admin` — should show admin page (if pool owner)

- [ ] **Step 4: Commit the regenerated route tree**

```bash
git add src/routeTree.gen.ts
git commit -m "chore: regenerate route tree for slug-based pool routes"
```

---

## Chunk 7: Update E2E Tests

### Task 11: Update E2E tests for new route structure

**Files:**

- Modify: `tests/e2e/pool-creation.spec.ts`

- [ ] **Step 1: Update the E2E tests**

The key changes:

- Pool creation now redirects to `/p/<slug>/dashboard` instead of staying on `/dashboard`
- Admin page is at `/p/<slug>/admin` instead of `/admin`
- Need to derive the slug from the pool name for URL assertions

```ts
// tests/e2e/pool-creation.spec.ts
import { test, expect } from "../support/fixtures";

test.describe("Pool Creation & Organization Setup", () => {
  test("authenticated user sees Create Pool CTA on empty dashboard", async ({
    browser,
    testHelpers,
  }) => {
    const email = `pool-cta-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "CTA Test User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");

      await expect(page.getByText("Create Your First Pool")).toBeVisible();
      await expect(page.getByLabel("Pool Name")).toBeVisible();
      await expect(page.getByRole("button", { name: "Create Pool" })).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("user can create a pool and is redirected to pool dashboard", async ({
    browser,
    testHelpers,
  }) => {
    const email = `pool-create-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Create Test User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");
      await expect(page.getByText("Create Your First Pool")).toBeVisible();

      const poolName = `Test Pool ${Date.now()}`;
      const input = page.getByLabel("Pool Name");
      await input.click();
      await input.fill(poolName);
      await input.dispatchEvent("input");

      const createBtn = page.getByRole("button", { name: "Create Pool" });
      await createBtn.click();

      // Should redirect to pool dashboard
      await page.waitForURL(/\/p\/[a-z0-9-]+\/dashboard/, { timeout: 15000 });

      // Pool dashboard should show the pool name
      await expect(page.getByText(poolName)).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("pool name validation rejects names that are too short", async ({
    browser,
    testHelpers,
  }) => {
    const email = `pool-short-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Short Name User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");

      await page.getByLabel("Pool Name").fill("Ab");
      await page.getByLabel("Pool Name").blur();

      await expect(page.getByText("Pool name must be at least 3 characters")).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("pool name validation rejects empty names", async ({ browser, testHelpers }) => {
    const email = `pool-empty-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Empty Name User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      await page.goto("/dashboard");

      await page.getByLabel("Pool Name").focus();
      await page.getByLabel("Pool Name").blur();

      await expect(page.getByText("Pool name must be at least 3 characters")).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("pool owner can access admin page", async ({ browser, testHelpers }) => {
    const email = `pool-admin-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Admin Test User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      // Create a pool first
      await page.goto("/dashboard");
      const input = page.getByLabel("Pool Name");
      await input.click();
      await input.pressSequentially("Admin Test Pool");
      await page.getByRole("button", { name: "Create Pool" }).click();

      // Wait for redirect to pool dashboard
      await page.waitForURL(/\/p\/[a-z0-9-]+\/dashboard/, { timeout: 15000 });

      // Navigate to admin page via the URL
      const url = page.url();
      const slug = url.match(/\/p\/([a-z0-9-]+)\//)?.[1];
      await page.goto(`/p/${slug}/admin`);

      // Admin page should load
      await expect(page.getByText("Pool Settings")).toBeVisible();
      await expect(page.getByText("Admin Test Pool")).toBeVisible();
      await expect(page.getByText("Pool Configuration")).toBeVisible();
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });

  test("non-owner cannot access admin page", async ({ browser, testHelpers }) => {
    const email = `pool-nonadmin-${Date.now()}@test.com`;
    const userData = testHelpers.createUser({ email, name: "Non-Admin User" });
    const savedUser = await testHelpers.saveUser(userData);
    const cookies = await testHelpers.getCookies({ userId: savedUser.id, domain: "localhost" });
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
      // Navigate to a pool admin page they're not a member of
      await page.goto("/p/nonexistent-pool/admin");

      // Should be redirected to dashboard (pool layout catches non-members)
      await page.waitForURL("/dashboard", { timeout: 10000 });
    } finally {
      await testHelpers.deleteUser(savedUser.id);
      await context.close();
    }
  });
});
```

- [ ] **Step 2: Run the E2E tests** (requires dev server running)

Run: `cd /home/kellen/dev/nhl-pool && npx playwright test tests/e2e/pool-creation.spec.ts`
Expected: All 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/pool-creation.spec.ts
git commit -m "test: update E2E tests for slug-based pool routes and auto-redirect"
```

---

## Chunk 8: Cleanup

### Task 12: Verify no dead imports and clean up

- [ ] **Step 1: Run type check**

Run: `cd /home/kellen/dev/nhl-pool && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `cd /home/kellen/dev/nhl-pool && npx oxlint`
Expected: No errors related to changed files

- [ ] **Step 3: Run formatter**

Run: `cd /home/kellen/dev/nhl-pool && npx oxfmt --write src/components/account-nav-bar.tsx src/components/pool-nav-bar.tsx src/server/functions/pool-context.ts src/routes/_authenticated/route.tsx src/routes/_authenticated/dashboard/index.tsx "src/routes/_authenticated/p/\$slug/**/*.tsx"`
Expected: Files formatted

- [ ] **Step 4: Final commit if formatting changed anything**

```bash
git add -A
git commit -m "chore: format new and modified files"
```

---

## Deferred Scope

The following items from the spec are intentionally deferred to future stories:

- Admin sub-pages (`/p/$slug/admin/scoring-rules`, `/financial-model`, `/roster-config`, `/schedule`, `/members`, `/data-sync`) — only the admin index page is created in this plan. Sub-pages will be added as their respective features are implemented.
