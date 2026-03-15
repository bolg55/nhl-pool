# Implementation Roadmap

**Date:** 2026-03-15
**Status:** In progress

Ordered by dependency — each domain builds on the ones above it.

## Completed

### Phase 0: Foundation

- [x] Project scaffolding (react-tanstarter) + Railway Postgres setup
- [x] Better Auth + organization plugin + email OTP + better-auth-ui
- [x] Information architecture redesign (slug-based pool routes, adaptive nav, pool context pattern)

## Remaining

### Phase 1: Data Model & External APIs

- [ ] **Drizzle schema** — players, rosters, roster_snapshots, scoring_events, financial_ledger, weekly_schedules. The data model that everything else reads/writes.
- [ ] **NHL Salary API integration** — service wrapper for Kellen's existing API (players, salaries, positions, injuries, goaltender salaries). Sync into Postgres.
- [ ] **NHL-e API integration** — service wrapper for schedules, live boxscores, player game logs, goalie stats. Sync into Postgres.
- [ ] **Data sync orchestration** — admin-triggered salary refresh, staleness tracking, DB-as-cache pattern.

### Phase 2: Core Weekly Loop

- [ ] **Roster management** — position-validated builder (6F, 4D, 2G), salary cap enforcement, player picker, captain designation, roster rollover, lock mechanism, snapshot creation.
- [ ] **Scoring engine** — live scoring via NHL-e API polling, admin-configurable point values, captain multiplier, nightly batch for post-game stats (goaltending, hat tricks), weekly winner calculation.

### Phase 3: Views & Financials

- [ ] **Dashboard & standings** — leaderboard, weekly winner spotlight, live scoring view, lock countdown, season standings.
- [ ] **Financial model** — admin configurator (entrants, weeks, loss amount, fees, prize structure), derived payouts, tie-splits, balance preview. Running P&L tracker per member.

### Phase 4: Admin & Automation

- [ ] **Admin configuration pages** — scoring rules, roster constraints, captain toggle, goaltending mode, schedule boundaries, members & invites, data sync.
- [ ] **Cron services** — nightly batch (scoring reconciliation, winner calc, financial updates), scheduler (roster lock + reminder emails based on NHL schedule data).
- [ ] **Email automation** — roster reminders (night before + 1 hour before lock) with deep links.

### Phase 5: Polish

- [ ] **Landing page** — public page for discovery and invite entry points.
- [ ] **Error handling & edge cases** — stale data indicators, graceful degradation, error boundaries.

## Notes

- Each phase should go through the brainstorm → spec → plan → implement cycle
- The PRD (59 FRs) and architecture doc are the source of truth for requirements
- Phase 1 is the critical foundation — nothing works without the data model and NHL API data
- Phase 2 is the core product — the weekly roster cycle is the defining experience
- Phases 3-5 can be parallelized somewhat once Phase 2 is working
