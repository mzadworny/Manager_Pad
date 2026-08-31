# Default Unremovable All People Team — Plan Brief

> Full plan: `context/changes/all-people-default-team/plan.md`

## What & Why

Managers need a permanent “All people” home that always lists everyone, while other teams act as optional filters. Soft-deleting a team should remove the filter, not the people. Today, soft-delete leaves employees stuck on a deleted team and the dashboard has no unfiltered view.

## Starting Point

S-01 teams/employees CRUD is live: required `team_id`, soft-delete RPCs, dashboard list UI. There is no system team, no nullable assignment, and `GET /api/employees` always requires a team filter.

## Desired End State

Every manager has one undeletable `is_system` “All people” team used as the unfiltered people view. Filter teams optionally set `team_id`; `NULL` means no filter. Deleting a filter clears assignments and keeps people visible under All people. Rename/delete of All people and the reserved name are blocked in API and UI.

## Key Decisions Made

| Decision             | Choice                                          | Why (1 sentence)                                           | Source |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------- | ------ |
| All people semantics | Virtual unfiltered view (not dump-only bucket)  | Matches “teams are filters”; everyone always visible there | Plan   |
| System identity      | `is_system boolean` + unique per manager        | Stable guards even if display rules change                 | Plan   |
| Seed timing          | Ensure on `GET /api/teams` + migration backfill | Idempotent; signup stays untouched                         | Plan   |
| Membership           | Nullable single `team_id` (`NULL` = no filter)  | One filter max; multi-filter still deferred                | Plan   |
| On filter delete     | Clear `team_id` → NULL, then soft-delete team   | Removes filter; people stay in All people                  | Plan   |
| Create employee      | From All people → `null`; from filter → that id | Always visible in All people                               | Plan   |
| Guards               | No rename/delete; reject reserved name          | API + UI defense in depth                                  | Plan   |

## Scope

**In scope:**

- Migration: `is_system`, nullable `team_id`, backfill, RPC rewrite
- Types + teams/employees API contracts (ensure, guards, unfiltered list)
- Dashboard: default All people, hide system actions, null create path

**Out of scope:**

- Multi-filter membership / junction table
- Assigning employees to the system team UUID
- Signup-time seed, restore flows, S-02 meetings

## Architecture / Approach

System team row = navigation affordance. Unfiltered set = all manager employees. Filter set = `team_id = <team>`. Soft-delete RPC clears filter then stamps `deleted_at`. Ensure-on-GET heals any manager missing the system row.

## Phases at a Glance

| Phase                       | What it delivers                                    | Key risk                                                 |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| 1. Schema & Soft-Delete RPC | `is_system`, nullable FK, backfill, safe delete     | Legacy orphans pointing at already soft-deleted teams    |
| 2. Types & API Contracts    | Ensure, guards, null/unfiltered employee APIs       | Accidentally allowing assign-to-system-UUID              |
| 3. Dashboard UI             | Default All people, hide actions, create/list paths | Count/fetch mismatch if system team treated as filter id |

**Prerequisites:** S-01 implemented; local Supabase for migration apply
**Estimated effort:** ~1–2 sessions across 3 phases

## Open Risks & Assumptions

- Pre-existing soft-deleted teams may still be referenced by `team_id` until the optional orphan-nulling SQL in Phase 1 runs
- Reserved-name check is case-insensitive equality on `"all people"` only — no i18n variants
- No automated tests; success relies on lint/build + manual UI/API checks

## Success Criteria (Summary)

- All people always present, selected by default, not renameable/deletable
- Employees created anywhere appear under All people; filter teams show subsets
- Deleting a filter keeps people under All people
