# Reassign Employee Team Implementation Plan

## Overview

Add a Team select to the employee create/edit dialog so managers can assign or fix filter membership after the fact, and show each person’s current filter label on the All people list so mis-assignments are visible without opening edit.

## Current State Analysis

`all-people-default-team` made filter membership nullable (`employees.team_id`) and API-capable for moves: `POST`/`PATCH` accept `teamId: string | null`, reject the system team UUID, and treat `null` as unfiltered (All people). Soft-deleting a filter clears `team_id` to `NULL`.

The UI still treats assignment as create-context-only:

- `EmployeeDialog` sends `teamId` on create from the selected list; edit PATCHes only `name`/`role` so All-people edits never clear a filter
- `EmployeeList` rows show name + role only — no filter label on All people
- shadcn `Select` exists at `src/components/ui/select.tsx` but is unused

`TeamList` already loads teams (system first) and can pass non-system teams down for the picker and name map.

## Desired End State

Managers can set or clear an employee’s filter team from the employee dialog on both create and edit. Create defaults to the current list context (All people → `null`, filter → that UUID) but the select is editable before save. Edit prefills from `employee.teamId`. Saving reloads the current list in place (a person who leaves the open filter disappears from that view; counts refresh). On the All people view only, each row shows a subtitle with the filter team name or “No team”.

### Key Discoveries:

- PATCH contract already supports reassignment: `src/pages/api/employees/[id].ts` — `teamId` optional nullable; system UUID → 400; unknown → 404
- Dialog intentionally omits `teamId` on edit today: `src/components/employees/EmployeeDialog.tsx`
- Prior change deferred this picker: `context/changes/all-people-default-team/plan.md` (“What We're NOT Doing”)
- Pass teams from `TeamList` — avoid a second `/api/teams` fetch inside the dialog

## What We're NOT Doing

- Multi-team / multi-filter membership (still deferred per FR-003)
- Assigning the system team UUID as `team_id` (All people remains `null`)
- Separate row-level “Move to team…” action
- Showing filter subtitles inside a filter-team view (redundant)
- Schema/migration or API contract changes (unless a gap is found; none expected)
- Restoring soft-deleted teams

## Implementation Approach

UI-only vertical slice on top of the existing employees API. Plumb `teams` (non-system) from `TeamList` → `EmployeeList` → `EmployeeDialog`. Use shadcn `Select` with an “All people” option mapped to `null` (Radix Select needs a non-null item value — use a stable sentinel string in the control and map to/from `null` at the API boundary). Phase 1 ships the picker; Phase 2 adds All-people-only row labels using the same teams list as a name map.

## Critical Implementation Details

**Select null mapping.** Radix/`SelectItem` values are strings. Use a sentinel (e.g. `__all_people__`) for the All people option; map sentinel ↔ `null` only when building the POST/PATCH body and when initializing controlled state. Never send the sentinel or the system team UUID to the API.

**Edit must send `teamId`.** Once the picker exists, edit PATCH bodies include `teamId` (null or filter UUID) alongside name/role — reversing the Phase-3 omit from `all-people-default-team`, which existed only to avoid accidental clears.

---

## Phase 1: Employee Dialog Team Select

### Overview

Add a Team select to create and edit employee flows; wire it to existing POST/PATCH `teamId` semantics.

### Changes Required:

#### 1. Employee dialog

**File**: `src/components/employees/EmployeeDialog.tsx`

**Intent**: Let the manager choose All people (`null`) or a non-system filter team on create and edit, defaulting create to the list context and edit to the employee’s current `teamId`.

**Contract**: Accept a `teams: Team[]` prop of non-system teams (caller filters `isSystem`). Controlled or form-backed select with All people + each filter. Create POST body `{ name, role, teamId }` with `teamId: string | null`. Edit PATCH body includes `teamId` the same way. Surface API errors as today. Do not offer the system team as an assignable option.

#### 2. List → dialog plumbing

**Files**: `src/components/employees/EmployeeList.tsx`, `src/components/teams/TeamList.tsx`

**Intent**: Supply filter teams to the dialog without a duplicate fetch.

**Contract**: `TeamList` passes `teams.filter((t) => !t.isSystem)` into `EmployeeList`; `EmployeeList` passes them into `EmployeeDialog`. Preserve existing `teamId` / `countTeamId` list-context props for fetch and create default.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Create under All people with Team left as All people → employee has no filter; appears under All people
- Create under a filter, or change Team on create before save → employee appears in that filter and under All people
- Edit an employee’s Team (filter → another filter, filter → All people, All people → filter) → list reload reflects membership; leaving the open filter removes them from that view
- Select never lists a system/All people row as a filter UUID target; saving All people sends `teamId: null`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: All People Filter Labels

### Overview

On the All people list only, show each employee’s current filter name (or “No team”) so mis-assignments are visible without opening edit.

### Changes Required:

#### 1. Employee list row subtitle

**File**: `src/components/employees/EmployeeList.tsx`

**Intent**: When the list is in unfiltered (All people) context, show a secondary line with the resolved filter team name or “No team”.

**Contract**: When `teamId === null` (list context = All people), for each employee resolve `employee.teamId` against the passed non-system `teams` map; display that name, or “No team” when `employee.teamId` is null. When list context is a filter team, omit the subtitle. Keep name + role as the primary lines.

#### 2. Prop wiring (if not finished in Phase 1)

**File**: `src/components/teams/TeamList.tsx`

**Intent**: Ensure the All people `EmployeeList` receives the same non-system teams list used by the dialog for name resolution.

**Contract**: Pass filter teams into `EmployeeList` whenever it is rendered (including system selection). No extra network calls.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- All people rows show “No team” or the correct filter name under role
- Filter-team views do not show the redundant filter subtitle
- After reassign via edit, All people subtitle updates on reload

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None — no test runner in the repo; do not invent one in this change

### Integration Tests:

- None automated; exercise via dashboard UI + network tab if needed

### Manual Testing Steps:

1. Open dashboard → All people selected; open Add employee → Team defaults to All people; save → row shows “No team”
2. Create filter “Engineering”; add employee with Team = Engineering → visible under Engineering and All people (subtitle “Engineering”)
3. From All people, edit that employee → Team = All people → save → subtitle “No team”; Engineering count drops
4. From Engineering, edit remaining member → move to another filter or All people → they leave the Engineering list after reload
5. Confirm create under Engineering still defaults Team to Engineering but can be changed before save

## Performance Considerations

At ~20 reportees and few filter teams, resolving names from an in-memory teams array is trivial. No new fetches beyond the existing teams load on dashboard.

## Migration Notes

- None — no schema changes; existing `team_id` null/UUID values are enough for labels and picker prefills

## References

- Change notes: `context/changes/reassign-employee-team/change.md`
- Prior deferred picker: `context/changes/all-people-default-team/plan.md`
- Employees API: `src/pages/api/employees.ts`, `src/pages/api/employees/[id].ts`
- UI: `src/components/employees/EmployeeDialog.tsx`, `EmployeeList.tsx`, `src/components/teams/TeamList.tsx`
- Select primitive: `src/components/ui/select.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Employee Dialog Team Select

#### Automated

- [x] 1.1 npm run lint passes — d26077a
- [x] 1.2 npm run build passes — d26077a

#### Manual

- [x] 1.3 Create defaults and assign via Team select — d26077a
- [x] 1.4 Edit reassign updates list membership in place — d26077a
- [x] 1.5 All people option maps to teamId null (not system UUID) — d26077a

### Phase 2: All People Filter Labels

#### Automated

- [x] 2.1 npm run lint passes — a8c48f0
- [x] 2.2 npm run build passes — a8c48f0

#### Manual

- [x] 2.3 All people rows show filter name or No team — a8c48f0
- [x] 2.4 Filter views omit subtitle; labels update after reassign — a8c48f0
