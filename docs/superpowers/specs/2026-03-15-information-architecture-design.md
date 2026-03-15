# Information Architecture Redesign

**Date:** 2026-03-15
**Status:** Approved
**Context:** Story 1.4 (Pool Creation & Organization Setup) was blocked because the app's route structure and navigation didn't account for pool context. The planning docs (PRD, UX spec, architecture doc) designed a flat nav with Dashboard/Roster/Standings/Settings tabs visible at all times — but this breaks down when a user has no pool, and provides no mechanism for pool context switching.

## Problem

The current app shell mixes account-level and pool-level concerns:

- Nav shows Roster/Standings tabs before a user belongs to any pool
- No concept of "which pool am I in" in the URL or navigation
- Admin route assumes `activeOrganizationId` is set but nothing guarantees it
- The planning docs never defined the empty-state or pool-context-switching experience

## Design Decisions

### 1. Slug-Based Pool Routes

All pool-scoped pages live under `/p/$slug/...` where `$slug` is the Better Auth organization slug (auto-generated from pool name, unique).

**Route map:**

| Route                            | Level      | Who Sees It                            |
| -------------------------------- | ---------- | -------------------------------------- |
| `/`                              | Public     | Everyone (landing page)                |
| `/auth/sign-in`                  | Public     | Unauthenticated                        |
| `/auth/sign-up`                  | Public     | Unauthenticated                        |
| `/auth/callback`                 | Public     | OAuth/invite callback                  |
| `/dashboard`                     | Account    | Authenticated (pool list / create CTA) |
| `/settings`                      | Account    | Authenticated (profile, name, avatar)  |
| `/p/$slug/dashboard`             | Pool       | Pool members                           |
| `/p/$slug/roster`                | Pool       | Pool members                           |
| `/p/$slug/standings`             | Pool       | Pool members                           |
| `/p/$slug/live`                  | Pool       | Pool members                           |
| `/p/$slug/admin`                 | Pool Admin | Pool owner only                        |
| `/p/$slug/admin/scoring-rules`   | Pool Admin | Pool owner only                        |
| `/p/$slug/admin/financial-model` | Pool Admin | Pool owner only                        |
| `/p/$slug/admin/roster-config`   | Pool Admin | Pool owner only                        |
| `/p/$slug/admin/schedule`        | Pool Admin | Pool owner only                        |
| `/p/$slug/admin/members`         | Pool Admin | Pool owner only                        |
| `/p/$slug/admin/data-sync`       | Pool Admin | Pool owner only                        |

**Why slugs over IDs:** Human-readable URLs (`/p/mikes-pool/roster` vs `/pool/cm3x7abc/roster`). Better Auth's organization plugin generates unique slugs automatically. URLs are shareable and bookmarkable with full context.

### 2. Adaptive Navigation

The app shell adapts based on user state — three distinct nav configurations:

**State 1 — No pool:** Minimal shell. Logo + Settings + Sign Out. No pool-scoped tabs. Dashboard shows "Create a Pool" CTA or "wait for an invite" message.

**State 2 — In a pool (member):** Full pool nav. Tabs: Dashboard, Roster, Standings, Live. Pool name shown as context label.

**State 3 — In a pool (owner):** Same as member + Admin tab at the end.

**Mobile:** Bottom tab bar. Adapts the same way. "More" overflow menu for Settings + Admin (if owner).

**Why no tabs when no pool:** Showing links to Roster/Standings when no pool exists is confusing. The nav should reflect what the user can actually do.

### 3. Pool Layout Route

`_authenticated/p/$slug/route.tsx` is the architectural centerpiece. It's a TanStack Router layout route that:

1. **Resolves the slug** — looks up the organization by slug via a server function
2. **Validates membership** — confirms the current user is a member of this pool
3. **Provides pool context** — makes pool data (id, name, slug, user's role) available to all child routes via route context
4. **Renders the pool nav** — Dashboard/Roster/Standings/Live (+ Admin if owner)

**Data flow:**

```
User hits /p/mikes-pool/roster
        │
        ▼
  _authenticated/route.tsx
  → Checks session (existing behavior)
  → Renders minimal account shell
        │
        ▼
  _authenticated/p/$slug/route.tsx
  → Loader calls $getPoolBySlug(slug)
     → Validates user is member of this org
     → Returns { pool, role, member }
  → Not a member → redirect to /dashboard
  → Pool not found → 404
  → Provides context to children
  → Renders pool nav + <Outlet />
        │
        ▼
  _authenticated/p/$slug/roster/index.tsx
  → Reads pool context from route
  → Fetches roster data using pool.id
```

**activeOrganizationId sync:** The URL is the source of truth for pool context. When the pool layout loads, it syncs Better Auth's `activeOrganizationId` to match the slug. This keeps org-scoped API calls working without relying on session state for routing.

**Edge cases:**

- User navigates to a pool they're not in → redirect to `/dashboard`
- Pool slug doesn't exist → 404
- User creates a pool → redirect to `/p/new-slug/dashboard`
- User accepts an invite → redirect to `/p/slug/dashboard`
- Deep link from email → auth guard catches unauthenticated users, pool layout validates membership

### 4. Account Dashboard Auto-Redirect

The account-level dashboard (`/dashboard`) adapts based on pool membership:

- **No pools:** Welcome message + "Create a Pool" CTA
- **One pool:** Auto-redirect to `/p/slug/dashboard` — users in a single pool never see the account dashboard after initial setup
- **Multiple pools (future):** List of pool cards, tap to navigate

The auto-redirect for the single-pool case is the key UX decision for the MVP friend group. They log in and land directly in their pool.

### 5. Separate Admin Area

Admin configuration lives under `/p/$slug/admin/...` as its own clearly defined section:

- Scoring Rules
- Financial Model
- Roster Config
- Schedule
- Members & Invites
- Data Sync

The admin area is a separate tab, not integrated into member views. The pool owner (Mike) should have a clear, simple place for all configuration — distinct from the member experience.

## File Structure

```
src/routes/
├── __root.tsx                              # Root layout (providers, error boundary)
├── index.tsx                               # Landing page (/)
├── api/auth/$.ts                           # Better Auth handler
├── auth/
│   ├── sign-in.tsx                         # /auth/sign-in
│   ├── sign-up.tsx                         # /auth/sign-up
│   └── callback.tsx                        # /auth/callback
├── _authenticated/
│   ├── route.tsx                           # Auth guard + minimal account shell
│   ├── dashboard/
│   │   └── index.tsx                       # /dashboard (pool list / create / auto-redirect)
│   └── settings/
│       └── index.tsx                       # /settings (profile)
└── _authenticated/p/$slug/
    ├── route.tsx                           # Pool layout (context loader + pool nav + membership guard)
    ├── dashboard/
    │   └── index.tsx                       # /p/$slug/dashboard
    ├── roster/
    │   └── index.tsx                       # /p/$slug/roster
    ├── standings/
    │   └── index.tsx                       # /p/$slug/standings
    ├── live/
    │   └── index.tsx                       # /p/$slug/live
    └── admin/
        ├── index.tsx                       # /p/$slug/admin
        ├── scoring-rules.tsx               # /p/$slug/admin/scoring-rules
        ├── financial-model.tsx             # /p/$slug/admin/financial-model
        ├── roster-config.tsx               # /p/$slug/admin/roster-config
        ├── schedule.tsx                    # /p/$slug/admin/schedule
        ├── members.tsx                     # /p/$slug/admin/members
        └── data-sync.tsx                   # /p/$slug/admin/data-sync
```

## Impact on Existing Code

**Keep as-is:**

- Better Auth config (server + client) with organization plugin
- DB schema and all migrations
- `$createPool`, `$listUserPools` server functions
- Pool name Zod schema
- E2E test infrastructure (fixtures, test-auth)
- Auth routes
- Settings page
- shadcn components

**Modify:**

- `_authenticated/route.tsx` — strip pool nav, become minimal account shell (logo + settings + sign out)
- `nav-bar.tsx` — rewrite as pool-scoped nav, rendered by pool layout route, adapts tabs based on role
- `dashboard/index.tsx` (account-level) — simplify to pool list + create CTA + auto-redirect for single pool
- E2E tests — update URLs and assertions for new route structure

**Create:**

- `_authenticated/p/$slug/route.tsx` — pool layout (context + nav + membership guard)
- `_authenticated/p/$slug/dashboard/index.tsx` — pool-scoped dashboard
- `_authenticated/p/$slug/roster/index.tsx` — placeholder
- `_authenticated/p/$slug/standings/index.tsx` — placeholder
- `_authenticated/p/$slug/live/index.tsx` — placeholder
- `_authenticated/p/$slug/admin/index.tsx` — existing admin, moved under pool context
- `_authenticated/p/$slug/admin/...` — admin sub-pages (placeholders)
- New server function: `$getPoolBySlug(slug)` — resolves slug, validates membership, returns pool + role

**Delete:**

- `_authenticated/roster/index.tsx` (flat placeholder)
- `_authenticated/standings/index.tsx` (flat placeholder)
- `_authenticated/admin/index.tsx` (moves under pool)

## Scope

This is a routing and navigation restructure. No changes to:

- Data model or database schema
- Auth configuration or plugins
- Backend server functions (except adding `$getPoolBySlug`)
- Styling system or design tokens
