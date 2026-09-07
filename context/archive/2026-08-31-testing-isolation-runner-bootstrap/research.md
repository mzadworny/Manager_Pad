---
date: 2026-09-07T19:41:03+02:00
researcher: maciejzadworny
git_commit: 3f7a2fd3b128552e0072c280936923388087cbfd
branch: main
repository: Manager_Pad
topic: "Logged-in manager A can read or write manager B’s people, meetings, notes, or tasks"
tags: [research, codebase, isolation, rls, api-auth, employees, meetings, tasks]
status: complete
last_updated: 2026-09-07
last_updated_by: maciejzadworny
---

# Research: Logged-in manager A can read or write manager B’s people, meetings, notes, or tasks

**Date**: 2026-09-07T19:41:03+02:00
**Researcher**: maciejzadworny
**Git Commit**: 3f7a2fd3b128552e0072c280936923388087cbfd
**Branch**: main
**Repository**: Manager_Pad

## Research Question

Logged-in manager A can read or write manager B’s people, meetings, notes, or tasks

Grounding requested by `context/foundation/test-plan.md` risk #1: auth/session shape; how APIs take ids; RLS vs handler checks. Challenge: “logged in” ≠ “owns this row”; UI hide ≠ API deny.

## Summary

The failure would live at **RLS**, not at an ownership `if` in TypeScript. `requireApiAuth` only proves someone is logged in. Product handlers identify rows by UUID (path, query, or body) and collapse invisible results with `maybeSingle` → **404**, or return **200-empty** on two list-by-employee endpoints. There is no `if (row.manager_id !== user.id)` on people, meetings, notes, or tasks.

Identity is the Supabase Auth JWT in cookies (`getUser()` → `user.id` === `auth.uid()`). Inserts stamp `auth.user.id` (tasks copy `manager_id` from an RLS-visible parent). No Bearer path, no service-role client.

SSR pages `/employees/[id]` and `/meetings/[id]` pass the URL id into React islands; they do not load rows on the server. If B opens A’s person URL, the shell errors because `GET /api/employees/:id` is 404 — UI hide is a consequence of the API, not a substitute.

A representative HTTP matrix already exists in `tests/integration/cross-manager-isolation.test.ts`. It does **not** cover every write. Highest residual gaps: `PATCH /api/tasks/:id` (`completedMeetingId` stamp), `POST /api/meetings` on a foreign `employeeId`, and INSERT policies that do not bind child FKs to the same manager (the app’s parent lookup currently 404s those creates).

## Detailed Findings

### Auth / session shape

Cookie SSR client uses the anon/publishable key only ([`src/lib/supabase.ts:5-23`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/lib/supabase.ts#L5-L23)). Cookie names are whatever `@supabase/ssr` sets; nothing in `src/` hardcodes `sb-*-auth-token`.

Sign-in is form POST `email`/`password` → `signInWithPassword` → 302 `/dashboard` ([`src/pages/api/auth/signin.ts:6-21`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/auth/signin.ts#L6-L21)). No JSON token, no `Authorization` header.

Pages: middleware calls `getUser()`, sets `locals.user`, redirects guests only on `/dashboard`, `/employees`, `/meetings` ([`src/middleware.ts:6-21`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/middleware.ts#L6-L21), [`src/lib/protected-routes.ts:1-4`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/lib/protected-routes.ts#L1-L4)). **`/api/*` is not a protected page path.**

Product APIs ignore `locals.user`. They rebuild the cookie client and call `getUser()` again ([`src/lib/api-auth.ts:7-24`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/lib/api-auth.ts#L7-L24)):

- No user → **401** `{ error: "Unauthorized" }`
- Success → `{ supabase, user }` — **no row-ownership check**

There is no `service_role` usage under `src/`. No handler accepts a `managerId` / `manager_id` from the client. Query params (`teamId`, `employeeId`, `meetingId`) are resource filters, not identity.

### How APIs take ids (and what “deny” looks like)

All eight product API modules call `requireApiAuth`. Target rows are identified by:

| ID source  | Examples                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Path UUID  | `/api/employees/:id`, `/api/meetings/:id`, `/api/tasks/:id`, `/api/teams/:id`                                   |
| Query UUID | `GET /api/meetings?employeeId=`, `GET /api/tasks?employeeId=` or `?meetingId=`, `GET /api/employees?teamId=`    |
| Body UUID  | `POST` meeting/task/employee with parent ids; `PATCH` task `completedMeetingId`; employee `teamId` reassignment |

Handlers almost never `.eq("manager_id", auth.user.id)`. They `.eq("id", …)` (or filter by parent id) on the user-scoped client and treat empty as not found.

**Invisible by-id row → 404**, not 403. **403 is reserved for the caller’s own system team** rename/delete ([`src/pages/api/teams/[id].ts:62-63`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/teams/%5Bid%5D.ts#L62-L63), [`:118-119`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/teams/%5Bid%5D.ts#L118-L119)).

**List-by-foreign-parent is intentionally asymmetric:**

| Request                                 | Foreign parent | Status                                                                                                                                                                                                         |
| --------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/meetings?employeeId=`         | A’s employee   | **200** `{ meetings: [] }` — no employee probe ([`src/pages/api/meetings.ts:36-47`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/meetings.ts#L36-L47)) |
| `GET /api/tasks?employeeId=`            | A’s employee   | **200** `{ tasks: [] }`                                                                                                                                                                                        |
| `GET /api/tasks?meetingId=`             | A’s meeting    | **404** (meeting probed first)                                                                                                                                                                                 |
| `GET /api/employees?teamId=`            | A’s team       | **404** (team probed first)                                                                                                                                                                                    |
| `GET /api/employees` / `GET /api/teams` | n/a            | **200** own lists only                                                                                                                                                                                         |

Nested creates load the parent under RLS then insert. Foreign parent → 404:

- `POST /api/meetings` with A’s `employeeId` ([`src/pages/api/meetings.ts:68-78`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/meetings.ts#L68-L78)) — **untested**
- `POST /api/tasks` with A’s `meetingId` ([`src/pages/api/tasks.ts:122-137`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/tasks.ts#L122-L137)) — tested
- `POST /api/tasks` with A’s `employeeId` only ([`src/pages/api/tasks.ts:151-165`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/tasks.ts#L151-L165)) — **untested**

Task insert copies `manager_id` from the parent row, not from `auth.user.id` ([`src/pages/api/tasks.ts:142-175`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/tasks.ts#L142-L175)). That is safe only because the parent SELECT already ran under RLS. Teams/employees/meetings stamp `auth.user.id` on insert ([`src/pages/api/employees.ts:110`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/employees.ts#L110)).

`PATCH /api/tasks/:id` is the most powerful untested write: title, complete, and `completedMeetingId`. The stamp path loads the task and meeting under RLS, 404s if either is invisible, 400 if employee ids differ ([`src/pages/api/tasks/[id].ts:54-88`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/tasks/%5Bid%5D.ts#L54-L88)). The final update still keys only by task `id` ([`:107-119`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/tasks/%5Bid%5D.ts#L107-L119)).

### RLS vs handler checks

Four public tables: `teams`, `employees`, `meetings`, `tasks`. RLS is enabled on all. Policies are `to authenticated` only. SELECT adds `deleted_at is null`.

Example (teams; employees/meetings/tasks match):

```34:49:supabase/migrations/20260727000001_create_teams_and_employees.sql
create policy "teams_select" on public.teams
  for select to authenticated
  using (auth.uid() = manager_id and deleted_at is null);
-- insert/update/delete: auth.uid() = manager_id
```

Meetings/tasks: [`supabase/migrations/20260810105659_create_meetings_and_tasks.sql:44-77`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/supabase/migrations/20260810105659_create_meetings_and_tasks.sql#L44-L77).

**This is the isolation wall.** Handlers authenticate and apply product rules (system team, completed-meeting freeze, related-FK lookup). They do not re-assert manager ownership.

Soft-delete RPCs are `SECURITY DEFINER` (they skip table RLS) but every `UPDATE` still has `manager_id = auth.uid()` ([`soft_delete_task` `:98-102`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/supabase/migrations/20260810105659_create_meetings_and_tasks.sql#L98-L102); employee cascade [`:147-163`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/supabase/migrations/20260810105659_create_meetings_and_tasks.sql#L147-L163)). B cannot see or undelete A’s soft-deleted rows (SELECT needs both `auth.uid() = manager_id` and `deleted_at is null`; UPDATE USING is still `auth.uid() = manager_id`).

**All people** is one `is_system` team per `manager_id`. `ensureAllPeopleTeam` looks up `.eq("is_system", true)` with no `manager_id` filter ([`src/pages/api/teams.ts:19-24`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/teams.ts#L19-L24)) — that is safe **only because RLS** already scopes the lookup. B PATCH/DELETE of A’s system team UUID is 404 (row invisible), not 403.

INSERT/UPDATE policies do **not** require related FKs (`employee_id`, `team_id`, `meeting_id`, `completed_meeting_id`) to belong to the same manager. `completed_meeting_id` is a bare FK to `meetings(id)` ([`supabase/migrations/20260818112949_person_task_followup.sql:7-8`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/supabase/migrations/20260818112949_person_task_followup.sql#L7-L8)). Product APIs close that for cookie+`/api` by probing the parent first. Direct PostgREST with B’s JWT could insert a B-owned row pointing at A’s person/meeting id.

**Counterfactuals:**

- Drop RLS, keep handlers → by-id GET/PATCH and lists leak; soft-delete RPCs still refuse cross-manager; `ensureAllPeopleTeam` could latch onto another manager’s system team.
- Drop handlers, keep RLS (authenticated PostgREST) → row `manager_id` isolation holds; related-FK inserts and system-team rename become possible.

### UI is not the gate

[`src/pages/employees/[id].astro:5-11`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/employees/%5Bid%5D.astro#L5-L11) and [`src/pages/meetings/[id].astro:5-11`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/meetings/%5Bid%5D.astro#L5-L11) pass the URL UUID into islands. No server-side row load, so HTML cannot embed B’s notes.

`PersonShell` fetches employee + meetings + tasks in parallel ([`src/components/employees/PersonShell.tsx:54-63`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/components/employees/PersonShell.tsx#L54-L63)). Foreign person: employee GET 404 blocks the page; the other two would be 200-empty. Client filters (All people hidden from the picker, open vs completed tasks) are UX on **already-scoped** payloads. There is no `supabase.from` in components.

DTOs include `managerId` ([`src/types.ts:3`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/types.ts#L3), `:12`). Under RLS that is the caller’s own id, not a cross-manager leak.

### What existing tests already prove

[`tests/integration/cross-manager-isolation.test.ts`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/tests/integration/cross-manager-isolation.test.ts) matches the plan’s **representative** matrix: B cannot GET/PATCH A’s employee or meeting (topics), cannot see A’s ids in lists, 200-empty on `?employeeId=`, 404 on `?meetingId=` / `?teamId=` / POST task / DELETE task; A’s name, topics/notes, and task title are unchanged.

Not covered (handlers expected to 404 under RLS, unproven):

1. `PATCH /api/tasks/:id` (title / complete / `completedMeetingId`) — highest signal
2. `POST /api/meetings` with A’s `employeeId`
3. `POST /api/tasks` with A’s `employeeId` only
4. `POST /api/employees` / employee `PATCH teamId` with A’s team
5. Meeting PATCH `notesJson` / observations / conclusions / status (topics is the only write proven)
6. DELETE employee / meeting / team; PATCH team

CI still does not run `npm test` (test-plan §3 Phase 3). Isolation can regress without a red check.

## Code References

- [`src/lib/api-auth.ts:7-24`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/lib/api-auth.ts#L7-L24) — login gate only; 401 `{ error: "Unauthorized" }`
- [`src/lib/supabase.ts:5-23`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/lib/supabase.ts#L5-L23) — cookie SSR client, anon key
- [`src/middleware.ts:6-21`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/middleware.ts#L6-L21) — pages only; `/api` ungated
- [`src/pages/api/meetings.ts:36-47`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/meetings.ts#L36-L47) — list-by-employee is 200-empty, no parent probe
- [`src/pages/api/meetings.ts:68-84`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/meetings.ts#L68-L84) — POST probes employee then stamps `auth.user.id`
- [`src/pages/api/tasks.ts:122-175`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/tasks.ts#L122-L175) — nested create; `manager_id` copied from parent
- [`src/pages/api/tasks/[id].ts:54-119`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/tasks/%5Bid%5D.ts#L54-L119) — F1 stamp lookup; update still by task id
- [`src/pages/api/teams/[id].ts:58-63`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/src/pages/api/teams/%5Bid%5D.ts#L58-L63) — foreign 404 vs own-system 403
- [`supabase/migrations/20260727000001_create_teams_and_employees.sql:30-67`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/supabase/migrations/20260727000001_create_teams_and_employees.sql#L30-L67) — teams/employees RLS
- [`supabase/migrations/20260810105659_create_meetings_and_tasks.sql:44-77`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/supabase/migrations/20260810105659_create_meetings_and_tasks.sql#L44-L77) — meetings/tasks RLS
- [`tests/integration/cross-manager-isolation.test.ts:41-129`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/tests/integration/cross-manager-isolation.test.ts#L41-L129) — current proof matrix

## Architecture Insights

1. **Two gates, different jobs.** `requireApiAuth` = authentication (risk #2). RLS `auth.uid() = manager_id` = authorization (risk #1). Confusing them is the failure mode the test-plan names: a logged-in B is “allowed in” and then must still fail on A’s ids.
2. **404 is the isolation status.** Copying handler `if`s as an oracle is wrong — there are almost none. The oracle is “B never receives A’s payload; A’s row is unchanged.”
3. **200-empty is not a leak** for `?employeeId=` lists. It would become a leak if INSERT policies ever allowed B to attach rows to A’s `employee_id`.
4. **UI hide is downstream of API 404.** Adding SSR data loads on `/employees/[id]` or `/meetings/[id]` would be a new leak surface.
5. **F1 remainder is DB-shaped.** The API lookup landed; `completed_meeting_id` still has no same-manager constraint. Isolation tests never send that PATCH.

## Historical Context (from prior changes)

- [`context/changes/testing-isolation-runner-bootstrap/frame.md`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/context/changes/testing-isolation-runner-bootstrap/frame.md) — isolation was unproven, not observed broken; tests lock existing gates. Explicitly noted `research.md` was missing.
- [`context/changes/testing-isolation-runner-bootstrap/plan.md`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/context/changes/testing-isolation-runner-bootstrap/plan.md) — representative matrix (not every method); never 403; 200-empty vs 404 split. All four phases checked off; `change.md` is `implemented`.
- [`context/archive/2026-07-24-create-team-and-employee/plan.md`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/context/archive/2026-07-24-create-team-and-employee/plan.md) — RLS `auth.uid() = manager_id` chosen on day one; one-shot manual second-account check (step 9 / Progress 3.8) never became a suite.
- [`context/archive/2026-08-15-person-overview-task-followup/reviews/impl-review.md`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/context/archive/2026-08-15-person-overview-task-followup/reviews/impl-review.md) — F1: `completedMeetingId` accepted any meeting UUID because RLS only proves the **task** is yours. Fixed with API lookup (Fix A); DB trigger (Fix B) declined.
- [`context/foundation/prd.md`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/context/foundation/prd.md) — “Notes and tasks are private to the logged-in manager only.” No API/RLS wording; that came from S-01.

`context/foundation/lessons.md` has no isolation-specific rule (only UI-first phasing). This change is test/infra, so the UI-first lesson does not relocate the failure.

## Related Research

- [`context/archive/2026-08-31-selling-landing-page/research.md`](https://github.com/mzadworny/Manager_Pad/blob/3f7a2fd3b128552e0072c280936923388087cbfd/context/archive/2026-08-31-selling-landing-page/research.md) — public `/` and auth links; not isolation. Only other `research.md` in the repo.

## Open Questions

- Should the next isolation occupant be `PATCH /api/tasks/:id` with a foreign `completedMeetingId`, or `POST /api/meetings` on a foreign `employeeId`? Both are untested writes; the stamp path is the only one that previously had a real cross-tenant bug (F1).
- Is a DB check that FKs (`employee_id`, `meeting_id`, `completed_meeting_id`) match the row’s `manager_id` in scope, or is “product API + RLS” still the accepted boundary (test-plan §7 rejects pgTAP unless local Supabase becomes default)?
- Guest by-id GET/PATCH/DELETE is untested. All those handlers call `requireApiAuth`; if one dropped the call, PostgREST-via-SSR would still be empty (no anon SELECT), but the status would be 404 not 401.
- Isolation proofs are local-only until rollout Phase 3 wires CI.
