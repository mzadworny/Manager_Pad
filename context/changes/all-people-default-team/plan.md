# Default Unremovable All People Team Implementation Plan

## Overview

Introduce a per-manager system team named "All people" that always exists and cannot be renamed or deleted. Treat other teams as optional single filters via nullable `employees.team_id`. Selecting "All people" lists every employee for the manager; selecting a filter team lists only employees with that `team_id`. Soft-deleting a filter team clears assignments to `NULL`, then soft-deletes the team — people remain visible under "All people".

## Current State Analysis

S-01 (`create-team-and-employee`) delivered manager-scoped `teams` / `employees` with required `team_id`, soft-delete RPCs, JSON CRUD APIs, and a dashboard `TeamList` / `EmployeeList` UI.

Gaps relative to this change:

- No `is_system` (or equivalent) flag; any team can be renamed or soft-deleted
- `soft_delete_team` only sets `deleted_at` — employees keep pointing at the deleted team and disappear from filtered lists with no recovery path into a global view
- `GET /api/employees` requires `?teamId=` — no "list all for manager" path
- `employees.team_id` is `NOT NULL`; create/edit always send a UUID
- Dashboard empty state assumes zero teams; default selection is oldest team by `created_at`
- Signup does not seed teams; no ensure-on-load path

## Desired End State

Every manager has exactly one `is_system` team named "All people". The dashboard always shows it (preferentially first), with no rename/delete actions. Opening it lists all of that manager's employees. Filter teams behave as today for listing/creating with a concrete `team_id`, except:

1. New employees created while "All people" is selected get `team_id = NULL`
2. Soft-deleting a filter team clears its employees' `team_id` to `NULL`, then soft-deletes the team
3. API rejects rename/delete of system teams and rejects creating/renaming another team to the reserved name `"All people"`
4. Assigning an employee’s `team_id` to the system team UUID is rejected — unfiltered means `NULL`, not the system row

### Key Discoveries:

- Schema baseline: `supabase/migrations/20260727000001_create_teams_and_employees.sql` — `employees.team_id` NOT NULL FK `ON DELETE CASCADE`
- Soft-delete RPC: `supabase/migrations/20260804105500_add_soft_delete_rpc_functions.sql` — no reassignment, no system guard
- Team delete API: `src/pages/api/teams/[id].ts` — calls `soft_delete_team` only
- Employees API requires UUID `teamId` on GET/POST: `src/pages/api/employees.ts`
- UI always passes a concrete team id into `EmployeeList`: `src/components/teams/TeamList.tsx`
- No test runner — verify with lint/build + manual UI checks (same as S-01)

## What We're NOT Doing

- Multi-team / multi-filter membership (junction table) — still deferred per FR-003; one optional filter max
- Making "All people" a real assignment target (employees do not store the system team UUID as `team_id`)
- Signup-time insert of the system team (ensure-on-GET + migration backfill instead)
- Restore of soft-deleted teams/employees
- Cross-team picker UI in `EmployeeDialog` (create uses the currently selected list context; moving between filters can stay API-capable but no new picker required unless already present)
- Roadmap / PRD wording updates (optional follow-up; not required to ship)
- Meeting notes, tasks, or any S-02+ work

## Implementation Approach

Bottom-up, matching S-01: migration + RPC → shared types + API contracts → dashboard UI. The system team is a **navigation/view affordance** (`is_system`); the unfiltered people set is defined by “all employees for this manager,” not by FK to the system row. Filter membership is nullable `team_id`.

## Critical Implementation Details

**System team is not an assignment target.** Create/PATCH must never persist `team_id = <is_system team id>`. Unfiltered = `NULL`. If the UI selects "All people", omit `teamId` on GET and send `teamId: null` on POST.

**Soft-delete ordering.** Inside `soft_delete_team` (or a replacement RPC): refuse when `is_system`; otherwise `UPDATE employees SET team_id = NULL WHERE team_id = … AND manager_id = auth.uid() AND deleted_at IS NULL`, then soft-delete the team — same transaction / function body so partial failure cannot orphan the filter.

**Ensure is idempotent.** `GET /api/teams` must insert the system team only when the manager has none; rely on a unique partial index on `(manager_id) WHERE is_system` to make races safe.

---

## Phase 1: Schema & Soft-Delete RPC

### Overview

Add `teams.is_system`, make `employees.team_id` nullable, backfill "All people" for existing managers, and rewrite `soft_delete_team` to clear filters and refuse system deletes.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_all_people_system_team.sql` (timestamp at implement time)

**Intent**: Evolve the S-01 schema so each manager can own one undeletable system team, and employees can exist with no filter assignment.

**Contract**:

- Add `teams.is_system boolean not null default false`
- Unique partial index: one system team per manager (`manager_id` where `is_system`)
- Alter `employees.team_id` to nullable; change FK on delete behavior to `ON DELETE SET NULL` (hard-delete safety; soft-delete handled in RPC)
- Backfill: for each manager who needs one (prefer distinct `manager_id` from existing `teams`/`employees`, and/or `auth.users` as appropriate for local+hosted), insert `name = 'All people'`, `is_system = true` when missing
- Replace `public.soft_delete_team(uuid)`:
  - Return false / no-op (or raise) when team missing, not owned, already deleted, or `is_system`
  - Else clear matching employees’ `team_id` to NULL, set team `deleted_at = now()`, return whether the team row was updated
- Keep `GRANT EXECUTE` for `authenticated`

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase (`npx supabase db reset` or `migration up` per project practice)
- After apply, each backfilled manager has exactly one `is_system` team named `All people`
- Calling soft-delete on a system team does not delete it and does not clear unrelated employees
- Soft-deleting a non-system team nulls that team’s employees’ `team_id` and sets the team’s `deleted_at`

#### Manual Verification:

- Inspect rows in Supabase Studio / SQL: system flag, nullable `team_id`, unique system team per manager

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Types & API Contracts

### Overview

Expose `isSystem` and nullable `teamId` in shared types; make teams/employees APIs enforce the filter model and ensure the system team on list.

### Changes Required:

#### 1. Shared types

**File**: `src/types.ts`

**Intent**: Domain and row types must carry the system flag and nullable team assignment so UI/API stay typed.

**Contract**: `Team` / `TeamRow` include `isSystem` / `is_system`. `Employee.teamId` and `EmployeeRow.team_id` become `string | null`. Mappers (`toTeam`, `toEmployee`) pass them through.

#### 2. Teams list + create

**File**: `src/pages/api/teams.ts`

**Intent**: Every authenticated teams list returns (and creates if missing) the manager’s "All people" system team; creating a custom team cannot collide with the reserved name or set `is_system`.

**Contract**:

- `GET`: idempotently ensure one `is_system` team named `All people` for `auth.user.id`, then return teams (system team first, then others by `created_at` ascending is fine)
- `POST`: reject names that case-insensitively equal `all people`; insert only non-system teams (`is_system` stays default false)

#### 3. Teams update + delete guards

**File**: `src/pages/api/teams/[id].ts`

**Intent**: System teams cannot be renamed or soft-deleted via API; custom teams cannot be renamed to the reserved name.

**Contract**:

- `PATCH`: if target `is_system` → 403 (or 409) with a clear error; if new name equals reserved name → 400; else rename as today
- `DELETE`: if target `is_system` → 403/409 without calling RPC; else call updated `soft_delete_team` (RPC also refuses system as defense in depth)

#### 4. Employees list + create

**File**: `src/pages/api/employees.ts`

**Intent**: Support the unfiltered "All people" view and null filter on create; never assign the system team UUID.

**Contract**:

- `GET`: if `teamId` query param omitted → return all non-deleted employees for the manager (RLS); if present → must be a UUID of a **non-system** team owned by the user, then filter `.eq("team_id", …)`; system UUID as `teamId` → 400
- `POST`: `teamId: z.uuid().nullable()` (required key, may be null). `null` → insert `team_id: null`. Non-null → must be owned, non-system team; else 404/400

#### 5. Employees update

**File**: `src/pages/api/employees/[id].ts`

**Intent**: Allow clearing or changing the filter assignment without using the system team as a target.

**Contract**: `teamId` optional and nullable (`z.uuid().nullable().optional()`). `null` clears `team_id`. Non-null must be owned non-system. Widen update payload typing so `team_id` can be `null` (not `Record<string, string>` only).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes (with local env secrets available as for CI)

#### Manual Verification:

- `GET /api/teams` as a user with no prior system team creates "All people" and returns it
- `PATCH`/`DELETE` on system team id returns error; custom team named "All people" rejected
- `GET /api/employees` without `teamId` returns all people; with a filter team id returns only that filter
- `POST` employee with `teamId: null` succeeds; with system team UUID fails

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dashboard UI

### Overview

Make the dashboard treat "All people" as the default unfiltered home: always present, not editable/deletable, and the place where creates use `teamId: null`.

### Changes Required:

#### 1. Team list / selection

**File**: `src/components/teams/TeamList.tsx`

**Intent**: Prefer the system team on load; hide rename/delete for it; stop showing the “create your first team” empty state when only the system team exists; show accurate counts (all employees for system, filtered count otherwise); update delete copy to match filter semantics.

**Contract**:

- After `loadTeams`, default `selectedTeamId` to the `isSystem` team when present
- Hide Pencil/Trash for `team.isSystem`
- Remove or bypass the zero-teams empty CTA (system team means the list is never empty for a working ensure path); keep "Create team" for additional filter teams
- For system team employee count: fetch `/api/employees` with no `teamId`; for others keep `?teamId=`
- When rendering `EmployeeList`, pass a discriminant so All people uses unfiltered fetch / null create (e.g. `teamId={null}` or `isAllPeople` + id) — pick one clear prop shape and keep it consistent
- Delete dialog description: soft-delete removes the filter; people remain under All people

#### 2. Employee list + dialog

**Files**: `src/components/employees/EmployeeList.tsx`, `src/components/employees/EmployeeDialog.tsx`

**Intent**: List and create correctly for unfiltered vs filter contexts.

**Contract**:

- `EmployeeList`: when All people / null filter context — `GET /api/employees` with no query; create passes `teamId: null`. When filter team — existing `?teamId=` and create/edit with that UUID
- `EmployeeDialog`: accept `string | null` for `teamId`; POST/PATCH body uses `null` when unfiltered
- Empty-state copy can stay team-scoped (“No employees yet” / filter-specific) without implying people are destroyed when a filter is removed

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Fresh or existing manager opens `/dashboard` → "All people" visible, selected by default, no edit/delete controls on it
- Create employee under All people → appears there; create under a filter team → appears in that filter **and** under All people
- Delete a filter team that has people → team gone; people still listed under All people with no filter
- Attempt rename/delete of All people via UI is impossible; API still rejects if called directly
- Creating a custom team named "All people" fails with a clear error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None — no test runner in the repo yet; do not invent one in this change

### Integration Tests:

- None automated; use migration apply + API smoke via dashboard / network tab

### Manual Testing Steps:

1. Reset or migrate local DB; sign in; open dashboard — confirm "All people" exists and is selected
2. Create two employees under All people; create a filter team "Engineering"; create one employee while Engineering is selected
3. Switch All people → see all three; Engineering → see one
4. Soft-delete Engineering → confirm employee still under All people
5. Confirm no edit/delete on All people; confirm reserved-name create fails
6. Soft-delete an individual employee still works as before

## Performance Considerations

At ~20 reportees (PRD scale), an unfiltered employees GET plus per-filter counts on dashboard load is acceptable. No new caching or pagination required. Avoid N+1 surprises by keeping the existing per-team count pattern; for the system team use a single unfiltered fetch (reuse that payload for the All people count when selected if convenient).

## Migration Notes

- One forward migration; no rollback script required beyond standard Supabase migration discipline
- Existing employees keep their current `team_id` (still valid filters); they immediately appear under All people once the unfiltered GET ships
- Existing managers without a system team get one via migration backfill; any missed user is healed on next `GET /api/teams`
- Soft-deleted teams from before this change may still have employees pointing at deleted team ids; those employees remain invisible to filter queries but will appear in the unfiltered All people list — acceptable; optional one-time `UPDATE … SET team_id = NULL WHERE team_id IN (SELECT id FROM teams WHERE deleted_at IS NOT NULL)` in the same migration is recommended so legacy orphans are explicitly unfiltered

## References

- Change notes: `context/changes/all-people-default-team/change.md`
- Prior slice: `context/changes/create-team-and-employee/plan.md`
- Schema: `supabase/migrations/20260727000001_create_teams_and_employees.sql`
- Soft-delete RPC: `supabase/migrations/20260804105500_add_soft_delete_rpc_functions.sql`
- PRD FR-003 (single team / multi deferred): `context/foundation/prd.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema & Soft-Delete RPC

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — a696347
- [x] 1.2 Each backfilled manager has exactly one is_system All people team — a696347
- [x] 1.3 Soft-delete on system team is refused — a696347
- [x] 1.4 Soft-delete on filter team nulls employee team_id then soft-deletes team — a696347

#### Manual

- [x] 1.5 Inspect schema/rows in Studio or SQL (is_system, nullable team_id, uniqueness) — a696347

### Phase 2: Types & API Contracts

#### Automated

- [x] 2.1 npm run lint passes — bc7ac71
- [x] 2.2 npm run build passes — bc7ac71

#### Manual

- [x] 2.3 GET /api/teams ensures and returns All people — bc7ac71
- [x] 2.4 System team PATCH/DELETE and reserved name rejected — bc7ac71
- [x] 2.5 Employees GET all vs filter; POST null vs system UUID behavior verified — bc7ac71

### Phase 3: Dashboard UI

#### Automated

- [x] 3.1 npm run lint passes
- [x] 3.2 npm run build passes

#### Manual

- [x] 3.3 Dashboard defaults to All people without edit/delete controls
- [x] 3.4 Create under All people and under a filter; visibility rules hold
- [x] 3.5 Delete filter keeps people under All people
- [x] 3.6 Reserved-name create fails with clear error
