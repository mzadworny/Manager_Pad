# Reassign Employee Team — Plan Brief

> Full plan: `context/changes/reassign-employee-team/plan.md`

## What & Why

Managers need to fix wrong filter assignments and re-home people after a filter team is deleted. The API already supports nullable `teamId` on create/PATCH; this change adds the missing UI — a Team select on create/edit and visible filter labels on All people.

## Starting Point

All people is an `is_system` view; filter membership is optional `team_id`. Create uses list context; edit only updates name/role. Soft-delete clears filters to `NULL`. There is no picker and no All-people subtitle.

## Desired End State

Create and edit both expose a Team select (All people = `null`, plus non-system filters). Create defaults to the open list context. After save, the current list reloads in place. On All people only, each row shows the filter name or “No team”.

## Key Decisions Made

| Decision                  | Choice                      | Why (1 sentence)                                                              |
| ------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Picker placement          | Create + edit               | One control for assign and fix; create stays correctable before save          |
| Post-reassign UX          | Reload list in place        | Matches filter semantics; person leaves the open filter if moved away         |
| Filter visibility         | Subtitle on All people only | Audit mis-assignments where it matters; avoid redundant labels under a filter |
| Scope under time pressure | Keep picker + subtitle      | Both are small; together they close the gap                                   |
| Data for options/labels   | Pass teams from TeamList    | Reuse dashboard load; no second fetch                                         |

## Scope

**In scope:** Team select on employee dialog (create + edit); All-people row filter labels; plumb non-system teams from `TeamList`.

**Out of scope:** Multi-team membership; system UUID as assignment; row “Move…” action; filter-view subtitles; schema/API changes; restore soft-deleted teams.

## Architecture / Approach

UI-only. `TeamList` passes non-system `teams` → `EmployeeList` → `EmployeeDialog`. shadcn `Select` with a sentinel for All people mapped to API `null`. Edit PATCH includes `teamId`. Phase 2 resolves `employee.teamId` to names for All-people subtitles only.

## Phases at a Glance

| Phase                          | What it delivers                          | Key risk                                                   |
| ------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| 1. Employee dialog team select | Assign/reassign via Select on create/edit | Sentinel/`null` mapping bugs (system UUID sent by mistake) |
| 2. All people filter labels    | Subtitle on unfiltered list rows          | Stale name if teams prop omitted                           |

**Prerequisites:** `all-people-default-team` implemented (nullable `teamId` + API guards).
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- Radix Select needs a string sentinel for All people — implementer must never POST/PATCH that sentinel or the system team id
- Soft-deleted filter names won’t appear in the teams list; orphaned `team_id` pointing at a deleted team should be rare post-migration (treated as unknown → show “No team” or raw fallback — prefer “No team” if name missing)

## Success Criteria (Summary)

- Manager can create with an editable Team default and reassign via edit
- Leaving a filter via reassign removes the person from that list after reload
- All people rows show current filter or “No team”; filter views stay clean
