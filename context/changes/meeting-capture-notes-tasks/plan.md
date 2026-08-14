# Meeting Capture Notes & Tasks Implementation Plan

## Overview

Ship roadmap S-02 (north star): from the dashboard, open a thin person shell, create a meeting with an editable date, prepare topics, take TipTap rich-text notes, and manage dated tasks in a side panel — with continuous autosave once persistence lands. Phases are **UI-first** (local/mock state for manual testing), then schema, API, and wire-up.

## Current State Analysis

- Teams/employees CRUD works on `/dashboard` (S-01 + All people + reassign). No person page, meeting routes, notes, or tasks.
- Schema has `teams` / `employees` only; manager-scoped RLS + soft-delete RPCs. No meetings/tasks tables.
- No TipTap (or other editor) dependency. Product APIs use JSON + zod + `requireApiAuth`; pages use `client:load` islands.
- Finalize (S-03) and person-overview polish (S-04) are separate roadmap slices; this change only seeds what they need (`status = open`, thin person shell, task rows with `completed_at`).

### Key Discoveries:

- Soft-delete cascade belongs inside `security definer` RPCs (see rewritten `soft_delete_team` in `supabase/migrations/20260806125103_all_people_system_team.sql`) — not FK `ON DELETE CASCADE`
- TipTap v3 + React 19: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-list` (TaskList/TaskItem); set `immediatelyRender: false` under Astro SSR
- Middleware `PROTECTED_ROUTES` currently only `["/dashboard"]` (`src/middleware.ts`); APIs auth separately via `requireApiAuth`
- Shared DTO pattern: camelCase interfaces + `*Row` + `to*` mappers in `src/types.ts`

## Desired End State

A logged-in manager can:

1. From an employee row on the dashboard, open `/employees/[id]` (name/role, meeting list, “New meeting”)
2. Create a meeting (default date today, editable); open `/meetings/[id]`
3. Edit topics (plain text) and rich-text notes (bold, italic, lists, links, headings, task checklists in the note body)
4. Create/edit/soft-delete tasks in a desktop side panel (title required; planned date optional; toggle done via `completed_at`)
5. See Saving / Saved / error+Retry while notes, topics, meeting date, and tasks persist without a manual Save button
6. Soft-deleting an employee soft-deletes their meetings and tasks

Verify: click through the live 1-on-1 capture loop on local Cloudflare + Supabase; soft-deleted employee’s meetings disappear from UI; failed save shows retry.

## What We're NOT Doing

- Finalize UI: observations, conclusions, mark meeting complete (S-03) — only `status` default `open` exists
- Full person overview: cross-meeting task panel, three-column layout (S-04)
- Voice notes (S-05), AI summaries (FR-011)
- `notes_text` / FTS column (defer until search or AI needs it)
- Offline queue, multi-tab conflict merge, optional vs required beyond decisions below
- Task assignee, priority, or employee-facing portal
- Hard-delete of meetings/tasks

## Implementation Approach

Four phases, UI-first (project preference in `AGENTS.md` / `lessons.md`):

1. Interactive shells with **sessionStorage** mock store (survives Astro full-page navigations) + TipTap local edits
2. Supabase migration for `meetings` / `tasks` + RLS + soft-delete RPCs (including employee cascade)
3. JSON APIs + shared types matching the Phase 1 DTO contract
4. Replace mock store with fetch; debounced autosave with generation token, Saved-only-on-2xx, error banner + retry; expand protected routes if not already done in Phase 1

Pin the **shared domain contract** in Phase 1 so later phases do not drift:

| Entity      | Fields (API/UI camelCase)                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Meeting     | `id`, `managerId`, `employeeId`, `meetingDate` (YYYY-MM-DD), `topics` (string), `notesJson` (TipTap JSON doc), `status` (`"open"` only in UI), `createdAt`, `updatedAt`  |
| Task        | `id`, `managerId`, `meetingId`, `employeeId` (denormalized for S-04), `title`, `plannedDate` (YYYY-MM-DD \| null), `completedAt` (ISO \| null), `createdAt`, `updatedAt` |
| Empty notes | `{ type: "doc", content: [{ type: "paragraph" }] }` — never `null` / `{}`                                                                                                |

## Critical Implementation Details

### Timing & lifecycle

Astro navigations remount islands — Phase 1 must not rely on in-memory module state alone. Use a small `sessionStorage` mock repository keyed by manager session / employee / meeting ids, replaced wholesale in Phase 4.

Autosave: debounce 500–1000ms; monotonic save generation (or AbortController); never `setContent` from a successful PATCH while editing; flush pending debounce on unmount / meeting switch; empty doc still PATCHes (clearing text must persist).

### Soft-delete cascade

Extend `soft_delete_employee` to soft-delete tasks then meetings for that employee (scoped by `manager_id = auth.uid()`), then the employee. `soft_delete_meeting` soft-deletes that meeting’s tasks then the meeting. API DELETE handlers only call RPCs.

---

## Phase 1: Capture UI shells (local state)

### Overview

Clickable capture loop with real employee fetch where possible and mock meetings/tasks in `sessionStorage`, so layout and editor UX can be tested before any migration.

### Changes Required:

#### 1. TipTap dependencies

**File**: `package.json` (via `npm i`)

**Intent**: Add TipTap v3 packages aligned on one version for the notes island.

**Contract**: Install `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-list`. No separate link package (StarterKit includes Link).

#### 2. Shared DTO stubs (UI contract)

**File**: `src/types.ts`

**Intent**: Add `Meeting` / `Task` interfaces (and empty-doc constant) so UI props match the eventual API.

**Contract**: Export types per the shared domain contract table above; export `EMPTY_NOTES_DOC`. Row mappers can wait until Phase 3 if preferred, but DTO shapes must not change later.

#### 3. Session mock store

**File**: `src/lib/meeting-mock-store.ts` (or under `src/components/meetings/`)

**Intent**: CRUD meetings/tasks in `sessionStorage` for Phase 1 navigation and edits.

**Contract**: Functions to list meetings by `employeeId`, get/create/update meeting, list/create/update/soft-delete tasks by `meetingId`. Soft-delete = filter out of lists (mirror eventual RLS). Clear or namespace keys so Phase 4 can delete this module.

#### 4. Dashboard entry

**File**: `src/components/employees/EmployeeList.tsx` (and row UI as needed)

**Intent**: Let the manager open the person shell from an employee row.

**Contract**: Navigate to `/employees/[id]` (link or button). Keep existing edit/delete actions.

#### 5. Person shell page

**File**: `src/pages/employees/[id].astro` + React island e.g. `src/components/employees/PersonShell.tsx`

**Intent**: Thin person view: employee name/role, meeting list, create meeting (date default today, editable before or right after create).

**Contract**: Load employee via existing `GET /api/employees` (or by id if added — prefer filtering client list or a small `GET /api/employees/[id]` GET if missing). Meetings from mock store. “New meeting” creates mock meeting and navigates to `/meetings/[id]`. Clicking a list row opens that meeting.

#### 6. Meeting capture page

**File**: `src/pages/meetings/[id].astro` + islands under `src/components/meetings/`

**Intent**: Two-column desktop layout: topics + TipTap notes (main); tasks side panel. Stack on small screens (tasks below).

**Contract**:

- Topics: controlled plain textarea bound to mock meeting `topics`
- Notes: TipTap with StarterKit (headings 1–3, bold, italic, bullet/ordered lists, link) + TaskList/TaskItem; `immediatelyRender: false`; toolbar buttons; persist JSON to mock store on debounce (local “Saved” ok)
- Meeting date: editable date input writing `meetingDate`
- Tasks panel: list title + optional planned date + done checkbox (`completedAt`); add/edit/delete; mock store only
- Subtle Saving/Saved indicator (mock latency optional)

#### 7. Protect new page routes

**File**: `src/middleware.ts`

**Intent**: Require auth for person and meeting pages during UI testing.

**Contract**: `PROTECTED_ROUTES` includes `/dashboard`, `/employees`, `/meetings` (`startsWith` match).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- TipTap packages present in `package.json` / lockfile

#### Manual Verification:

- From dashboard, open an employee → person shell shows name and empty or mock meetings
- Create meeting → meeting page opens with today’s date editable
- Topics, rich-text (including checklist), and tasks (optional date, toggle done) work across reload within the same browser session (sessionStorage)
- Mobile width stacks tasks under notes; desktop shows side panel
- Unauthenticated visit to `/employees/...` or `/meetings/...` redirects to sign-in

**Implementation Note**: Pause for manual UX confirmation before Phase 2.

---

## Phase 2: Schema & RLS

### Overview

Add `meetings` and `tasks` with manager RLS, soft-delete, and cascade RPCs aligned to the Phase 1 DTO contract.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_create_meetings_and_tasks.sql`

**Intent**: Persist meetings and tasks with the same ownership/soft-delete model as employees.

**Contract**:

- `meetings`: `id`, `manager_id` → `auth.users` ON DELETE CASCADE, `employee_id` → `employees(id)` (prefer ON DELETE RESTRICT or no hard cascade — soft-delete via RPC), `meeting_date` (date NOT NULL), `topics` (text NOT NULL DEFAULT `''`), `notes_json` (jsonb NOT NULL DEFAULT empty doc), `status` (text NOT NULL DEFAULT `'open'`), `created_at`, `updated_at`, `deleted_at`
- `tasks`: `id`, `manager_id`, `meeting_id` → `meetings(id)`, `employee_id` → `employees(id)` (denormalized; set on insert from meeting), `title` (text NOT NULL), `planned_date` (date nullable), `completed_at` (timestamptz nullable), timestamps + `deleted_at`
- Indexes: `(manager_id, employee_id)`, `(meeting_id)` on tasks; meetings `(manager_id, employee_id)`
- RLS per-op policies mirroring teams/employees; SELECT filters `deleted_at IS NULL`
- `set_updated_at` triggers on both tables
- RPCs: `soft_delete_meeting`, `soft_delete_task`; replace `soft_delete_employee` to cascade soft-delete tasks → meetings → employee (all scoped to `auth.uid()`)
- Grant execute on new RPCs to `authenticated`

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` (or migrate) applies cleanly
- Dump/studio shows tables, RLS, and RPCs

#### Manual Verification:

- Insert a meeting/task as the logged-in user in Studio; second user cannot see them
- Call `soft_delete_employee` in SQL and confirm child meetings/tasks get `deleted_at`

**Implementation Note**: Pause after cascade check before Phase 3.

---

## Phase 3: API & types

### Overview

JSON CRUD for meetings and tasks using S-01 status codes and mappers; DTOs already shaped in Phase 1.

### Changes Required:

#### 1. Row types and mappers

**File**: `src/types.ts`

**Intent**: Add `MeetingRow` / `TaskRow` and `toMeeting` / `toTask`.

**Contract**: Snake_case rows ↔ camelCase DTOs; omit `deletedAt` from DTOs (RLS hides soft-deleted).

#### 2. Meetings API

**Files**: `src/pages/api/meetings.ts`, `src/pages/api/meetings/[id].ts`

**Intent**: List/create by employee; get/patch/soft-delete meeting.

**Contract**:

- `GET /api/meetings?employeeId=` → `{ meetings: Meeting[] }` (400 if missing employeeId)
- `POST /api/meetings` → `{ employeeId, meetingDate? }` → 201 `{ meeting: Meeting }` (default date today, empty topics/notes/status open)
- `GET /api/meetings/[id]` → `{ meeting: Meeting }` (optional but useful for meeting page SSR/island bootstrap)
- `PATCH /api/meetings/[id]` → partial `{ meetingDate?, topics?, notesJson?, status? }` — v1 UI should not send status transitions other than leaving `open`; reject unknown status values if any slip in
- `DELETE /api/meetings/[id]` → RPC `soft_delete_meeting` → 204 / 404
- `prerender = false`; 401/400/404/500 as employees API

#### 3. Tasks API

**Files**: `src/pages/api/tasks.ts`, `src/pages/api/tasks/[id].ts`

**Intent**: List/create for a meeting; patch/soft-delete task.

**Contract**:

- `GET /api/tasks?meetingId=` → `{ tasks: Task[] }`
- `POST /api/tasks` → `{ meetingId, title, plannedDate? }` → 201; server copies `employee_id` / `manager_id` from meeting
- `PATCH /api/tasks/[id]` → partial `{ title?, plannedDate?, completedAt? }` (`completedAt: null` reopens)
- `DELETE` → `soft_delete_task` → 204
- Same auth/error conventions

#### 4. Employee GET by id (if not added in Phase 1)

**File**: `src/pages/api/employees/[id].ts`

**Intent**: Support person shell with a single-employee fetch without listing all.

**Contract**: Add `GET` returning `{ employee: Employee }` or 404; keep existing PATCH/DELETE.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npm run build` pass
- Handlers export `prerender = false` and uppercase methods

#### Manual Verification:

- With auth cookies, create meeting + task via curl/HTTP; list returns them; DELETE returns 204 and hides from GET
- Unauthenticated requests return 401

**Implementation Note**: Pause before swapping the UI off the mock store.

---

## Phase 4: Persist & autosave

### Overview

Replace sessionStorage with APIs; real debounced autosave with failure UX; remove mock module.

### Changes Required:

#### 1. Person shell → live meetings

**File**: `src/components/employees/PersonShell.tsx` (and related)

**Intent**: List/create meetings via `/api/meetings`.

**Contract**: No mock store reads/writes; empty state + create navigates to real meeting id.

#### 2. Meeting page → live load + autosave

**Files**: meeting islands / hooks under `src/components/meetings/` and optionally `src/components/hooks/`

**Intent**: Load meeting + tasks from API; autosave topics, `notesJson`, `meetingDate` with debounce + generation token; Saving / Saved / error banner + Retry (Retry PATCHes current editor JSON, not a stale snapshot).

**Contract**: Saved only after HTTP 2xx; flush on unmount; last-write-wins; no offline queue.

#### 3. Tasks panel → live CRUD

**File**: task side panel component(s)

**Intent**: Create/patch/delete/toggle complete via `/api/tasks`; optimistic UI optional but errors must surface inline.

**Contract**: Optional `plannedDate`; `completedAt` ISO or null; soft-delete via DELETE.

#### 4. Remove mock store

**File**: `src/lib/meeting-mock-store.ts` (delete) and purge imports

**Intent**: No dual sources of truth after wire-up.

**Contract**: Repo has no sessionStorage meeting mock; grep clean.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npm run build` pass
- No remaining imports of the mock store

#### Manual Verification:

- Full loop: dashboard → person → create meeting → type notes/topics → add task with/without date → toggle done → reload → data intact
- Kill network or force API 500 during typing → error banner + Retry restores persistence
- Soft-delete employee → their meetings no longer listed; new meetings for others unaffected
- Soft-delete meeting → its tasks gone from API/UI

**Implementation Note**: This phase completes the change; run end-to-end manual checklist below before marking implemented.

---

## Testing Strategy

### Unit Tests:

- None required — no test runner in repo yet (`AGENTS.md`)

### Integration Tests:

- None automated; use manual API checks in Phases 3–4

### Manual Testing Steps:

1. Create team/employee if needed; open person shell from dashboard
2. Create two meetings; confirm list order/date display is sensible
3. Edit topics and rich notes (heading, link, checklist); wait for Saved; hard-refresh
4. Add tasks with and without planned dates; complete one; refresh
5. Soft-delete a task; confirm it stays gone
6. Soft-delete employee with meetings; confirm cascade
7. Repeat a failed-save scenario (DevTools offline) and Retry

## Performance Considerations

Autosave PATCHes TipTap JSON frequently — keep debounce ≥500ms and avoid re-sending unchanged snapshots if easy. Payload size for normal 1-on-1 notes is fine; no FTS/generated text column yet. Watch Workers ↔ Supabase RTT (see `context/foundation/infrastructure.md`).

## Migration Notes

- New migration only; no backfill (no prior meeting data)
- `soft_delete_employee` replacement must keep existing signature (`employee_id_param uuid` → boolean) so `DELETE /api/employees/[id]` stays unchanged
- Phase 1 sessionStorage data is disposable; do not migrate it into Supabase

## References

- PRD: `context/foundation/prd.md` (FR-004–006, autosave NFR, privacy)
- Roadmap S-02: `context/foundation/roadmap.md`
- Pattern source: `context/changes/create-team-and-employee/plan.md`
- Soft-delete cascade example: `supabase/migrations/20260806125103_all_people_system_team.sql`
- UI-first preference: `context/foundation/lessons.md`, `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Capture UI shells (local state)

#### Automated

- [x] 1.1 `npm run lint` passes — baf826c
- [x] 1.2 `npm run build` passes — baf826c
- [x] 1.3 TipTap packages present in `package.json` / lockfile — baf826c

#### Manual

- [x] 1.4 From dashboard, open an employee → person shell shows name and meetings — baf826c
- [x] 1.5 Create meeting → meeting page opens with today’s date editable — baf826c
- [x] 1.6 Topics, rich-text, and tasks work across reload in the same browser session — baf826c
- [x] 1.7 Mobile stacks tasks; desktop shows side panel — baf826c
- [x] 1.8 Unauthenticated `/employees` or `/meetings` redirects to sign-in — baf826c

### Phase 2: Schema & RLS

#### Automated

- [x] 2.1 Migration applies cleanly (`npx supabase db reset` or migrate)
- [x] 2.2 Dump/studio shows tables, RLS, and RPCs

#### Manual

- [x] 2.3 Second user cannot see first user’s meetings/tasks
- [x] 2.4 `soft_delete_employee` cascades to meetings and tasks

### Phase 3: API & types

#### Automated

- [ ] 3.1 `npm run lint` and `npm run build` pass
- [ ] 3.2 Handlers export `prerender = false` and uppercase methods

#### Manual

- [ ] 3.3 Authenticated create/list/delete meeting + task via HTTP
- [ ] 3.4 Unauthenticated requests return 401

### Phase 4: Persist & autosave

#### Automated

- [ ] 4.1 `npm run lint` and `npm run build` pass
- [ ] 4.2 No remaining imports of the mock store

#### Manual

- [ ] 4.3 Full capture loop persists across reload
- [ ] 4.4 Failed save shows error banner + Retry works
- [ ] 4.5 Soft-delete employee hides cascaded meetings
- [ ] 4.6 Soft-delete meeting hides its tasks
