# Person Overview and Task Follow-up Implementation Plan

## Overview

Ship roadmap S-04 (US-01, FR-008–010): the person page becomes the between-meeting follow-up surface — select a meeting, read its fields, and manage all of that person’s tasks — while a 1-on-1’s side panel shows every open person-task plus work closed in that meeting. Phases are **UI-first**, then schema + API, then persistence.

## Current State Analysis

`/employees/[id]` is a thin hub (`PersonShell`): name/role, create meeting, list rows that navigate away to `/meetings/[id]`. Notes, wrap-up, and tasks live only on the meeting page (`max-w-6xl`, two-column grid). There is no in-page selector, no read pane, no employee-scoped task list.

- `GET /api/tasks` requires `meetingId` (origin only). `employee_id` is already denormalized and indexed (`idx_tasks_manager_employee`).
- `Task.meetingId` is required; `POST` copies `employee_id` from the meeting. Completing a task PATCHes `completedAt` only — no “closed in this meeting” stamp.
- `soft_delete_meeting` soft-deletes tasks where `meeting_id` = that meeting (origin cascade).
- `NotesEditor` seeds `initialContent` once (`useEditor` empty deps). `editable={false}` already hides the toolbar (S-03 completed meetings).
- Person page container is `max-w-3xl`; meeting page is `max-w-6xl`.

### Key Discoveries:

- S-02 deferred the three-column overview on purpose (`context/changes/meeting-capture-notes-tasks/plan.md`); S-03 left tasks writable on completed meetings so this slice can follow up
- `NotesEditor` will not swap documents when the selector changes unless remounted (`key={meeting.id}`)
- Collapsed/expanded height must be a CSS wrapper — `minHeightClass` is baked into `editorProps` at mount and will not track an expand toggle
- `TasksPanel` title inputs use `defaultValue`; swapping lists without `key={task.id}` shows stale titles
- Mixed meeting-panel list cannot be served by today’s origin-only `GET ?meetingId=`

## Desired End State

A logged-in manager can:

1. Open `/employees/[id]` and see a **three-column** desktop layout: meeting selector | selected meeting fields | all tasks for that person (stack on small screens)
2. Have the **newest** meeting selected by default (`meeting_date` desc, then `created_at` desc — existing list order). `?meeting=<id>` deep-links the selector
3. **Read** topics, notes, observations, and conclusions as **small expandable boxes** (read-only TipTap / textarea). Edit still happens on `/meetings/[id]` via an **Open meeting** link
4. **Add** a task from the overview with **no origin meeting**. **Mark complete** from the overview sets `completedAt` only (no close stamp)
5. On `/meetings/[id]`, the side panel lists **all open tasks for that employee** plus **tasks closed in this meeting**. Add still sets origin `meetingId`. Complete stamps `completedMeetingId` to this meeting. Uncomplete clears the stamp
6. Reload keeps floating tasks, stamps, and selector state after Phase 3

Verify: add a task on the person page → open a later meeting → see it in the open list → mark done there → it appears under closed-in-this-meeting; overview complete does not stamp a meeting; create meeting still opens capture.

## What We're NOT Doing

- Editing notes/topics/wrap-up or finalize/reopen on the person overview (stays on `/meetings/[id]`)
- Voice notes (S-05), AI summaries (FR-011)
- Task assignee, priority, due-date reminders, or an employee-facing portal
- Offline queue, multi-tab merge, FTS/`notes_text`
- Hard-delete; changing employee soft-delete cascade (still tasks → meetings → employee)
- New shadcn Collapsible (use a local expand toggle + CSS)
- Splitting Open/Completed **meeting** lists (selector stays one list with Open/Completed labels)
- Required planned dates

## Implementation Approach

Three phases, UI-first (`lessons.md`):

1. Clickable overview + mixed meeting task list, with a **sessionStorage overlay** for floating tasks and close-stamps (survives person ↔ meeting navigation; reload-until-Phase-3 is expected for new fields)
2. Migration + DTO/API: nullable origin `meeting_id`, `completed_meeting_id`, employee GET, optional create `meetingId`, PATCH stamp rules, cascade/backfill
3. Wire both surfaces to the new APIs; delete the overlay

Pin the **shared domain contract** in Phase 1:

| Field                       | Type                                        | Notes                                                                                 |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Task.meetingId`            | `string \| null`                            | Origin meeting; **null** = created on the person overview                             |
| `Task.completedMeetingId`   | `string \| null`                            | Meeting where it was marked done; **null** if still open or completed on the overview |
| `Task.employeeId`           | `string`                                    | Already denormalized; required for floating creates                                   |
| Overview Add                | POST without `meetingId`                    | Requires `employeeId`                                                                 |
| Meeting Add                 | POST with `meetingId`                       | Origin set; `employee_id` copied from meeting (unchanged)                             |
| Overview complete           | PATCH `{ completedAt }`                     | Do not send `completedMeetingId`; stamp stays null                                    |
| Meeting complete            | PATCH `{ completedAt, completedMeetingId }` | Stamp this meeting                                                                    |
| Uncomplete (either surface) | PATCH `{ completedAt: null }`               | API also clears `completed_meeting_id`                                                |

Existing completed rows backfill `completed_meeting_id = meeting_id` in Phase 2 so they still show as closed on their origin meeting.

## Critical Implementation Details

**Selector remounts notes.** `NotesEditor` does not react to `initialContent` after mount. The read pane must use `key={selectedMeetingId}` (and again if an expand toggle would otherwise need a new `minHeightClass`). Expand/collapse is a wrapper `max-height` + overflow, not a TipTap remount on every toggle.

**`GET ?meetingId=` becomes the follow-up view, not origin-only.** When `meetingId` is present, load that meeting, then return tasks for its `employee_id` where `completed_at IS NULL OR completed_meeting_id = meetingId`. Overview uses `GET ?employeeId=` (all tasks). Exactly one of `employeeId` or `meetingId` is required.

**Complete stamp is explicit.** The meeting `TasksPanel` must send `completedMeetingId` together with `completedAt`. The overview panel must omit it. Uncomplete always clears the stamp server-side so clients cannot leave a stamp on an open task.

**Deleting a meeting must not eat floating work.** Extend `soft_delete_meeting`: still cascade-soft-delete origin tasks (`meeting_id = param`); **null** `completed_meeting_id` on remaining tasks stamped to that meeting; then soft-delete the meeting. Do not soft-delete rows whose only link is the close stamp.

---

## Phase 1: Overview + meeting-panel shells

### Overview

Managers can click through the three-column person overview and the mixed meeting task list before any migration. Meetings and existing tasks still load from today’s APIs; floating creates and close-stamps live in a session overlay shared by both pages.

### Changes Required:

#### 1. Widen the person page

**File**: `src/pages/employees/[id].astro`

**Intent**: Give the three-column overview the same horizontal room as capture.

**Contract**: Container `max-w-3xl` → `max-w-6xl` (or equivalent). Keep `client:load` on the person island. Page title may stay “Person” or use the employee name if already available — do not add a blocking SSR fetch just for the title.

#### 2. Shared task DTO (UI contract)

**File**: `src/types.ts`

**Intent**: Person and meeting UIs share the follow-up task shape before the API exists.

**Contract**: `Task.meetingId` becomes `string | null`. Add `completedMeetingId: string | null`. Do not change mappers yet if the live API omits the new field — overlay/UI may default `completedMeetingId` to `null` until Phase 2.

#### 3. Session overlay for floating tasks and stamps

**File**: `src/lib/person-task-overlay.ts` (or under `src/components/employees/`)

**Intent**: Let overview Add and meeting complete-stamp work across Astro navigations before schema exists.

**Contract**: sessionStorage keyed by employee id. Support: add floating task (null origin); toggle complete from overview (completedAt only); toggle complete from a meeting (completedAt + completedMeetingId); uncomplete (clear both); merge overlay onto a fetched `Task[]` without duplicating live ids. Namespace so Phase 3 can delete the module. Do not pretend overlay rows survived a full browser restart as production data.

#### 4. Person overview island

**File**: `src/components/employees/PersonShell.tsx` (evolve in place; split child files under `src/components/employees/` if the file gets large)

**Intent**: Replace the navigational list hub with the follow-up overview without losing create-meeting or dashboard back-link.

**Contract**:

- Header: dashboard link, name, role, **New meeting** (date default today). Create still `POST /api/meetings` and **navigates to** `/meetings/[id]` (live capture entry unchanged)
- Desktop: `lg` three columns — selector | read pane | tasks. Below `lg`, stack selector → read pane → tasks
- Selector: existing API order; **Open** / **Completed** labels; **newest selected by default**. Read `?meeting=` on load when it matches a listed id; update the query string when the selection changes (`history.replaceState` is enough — no full reload)
- Clicking a selector row **selects in-page**; it does not navigate. Include a control to **Open meeting** (`/meetings/[id]`)
- Empty meetings: dashed empty selector + prompt in the read pane; task panel still allows floating adds
- Meetings still from `GET /api/meetings?employeeId=`. Tasks: fetch each meeting’s tasks **or** a single client merge of current meeting-scoped GETs, then apply the overlay. Phase 3 replaces this with one `employeeId` GET

#### 5. Read pane (expandable meeting fields)

**File**: new island piece e.g. `src/components/employees/MeetingReadPane.tsx`

**Intent**: FR-009 recall — all meeting fields visible in compact boxes, expandable, never editable here.

**Contract**:

- Show date + status in the pane header plus **Open meeting**
- Four boxes: **Topics** (plain text), **Notes**, **Observations**, **Conclusions** (read-only `NotesEditor`, `onChange` noop, `editable={false}`)
- Default: compact (`max-height` + overflow hidden). Each box has expand/collapse. Expanded box grows to content (still read-only)
- Remount editors with `key={meetingId}` when selection changes
- Empty doc / empty topics: short placeholder copy (“No notes yet”, etc.)

#### 6. Person tasks panel

**File**: generalize `src/components/meetings/TasksPanel.tsx` **or** add `src/components/employees/PersonTasksPanel.tsx` that reuses the same row CRUD helpers

**Intent**: One list of every task for the person; Add does not attach a meeting.

**Contract**:

- Add: title required, planned date optional; overlay/POST floating (`employeeId`, no `meetingId`)
- Toggle complete: overlay/PATCH `completedAt` only
- Edit title / planned date / delete: same as today’s panel (live API for persisted rows; overlay for local-only rows)
- Rows: show a short origin/close hint when present (e.g. origin date, or “Closed in …” once a stamp exists). Floating open tasks need no meeting label
- Order: open first, then completed. `key={task.id}` on title inputs
- Empty: “No tasks yet.”

#### 7. Meeting capture task list (mixed follow-up)

**File**: `src/components/meetings/MeetingCapture.tsx`, `src/components/meetings/TasksPanel.tsx`

**Intent**: During a 1-on-1 the manager sees leftover person-work and can close it with this meeting.

**Contract**:

- List = overlay-merged tasks that are **open for this employee** OR **`completedMeetingId` === this meeting** (Phase 1: approximate open-for-employee by merging tasks fetched for all of that employee’s meetings + overlay floating rows)
- Add: still posts `meetingId` (origin = this meeting)
- Complete: overlay/PATCH stamp `completedMeetingId` to this meeting
- Uncomplete: returns the task to the open person pool
- Optional subsection labels: open vs closed in this meeting — nice-to-have if it stays visually light; not required if one list with completed styling is clearer
- Completed **meetings** still allow task add/toggle (S-03 unchanged)

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Person page is three columns on a wide viewport and stacks on a narrow one; newest meeting is selected; `?meeting=` selects that row
- Read pane shows topics/notes/wrap-up in small boxes; expand reveals more; fields are not editable; **Open meeting** reaches capture
- Add a task on the person page; open a meeting; the task appears in the open list; mark it done there; it stays on that meeting’s list as completed and remains on the person list
- Mark a task done on the person page; it does not appear as “closed in” a meeting
- Create meeting still opens `/meetings/[id]`
- Reload drops overlay-only floating tasks / stamps (expected until Phase 3)

**Implementation Note**: Pause for manual UX confirmation before Phase 2.

---

## Phase 2: Schema & API

### Overview

Persist floating origin and close-stamps, and give both UIs a single round-trip list query so Phase 3 can drop N+1 meeting fetches and the overlay.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_person_task_followup.sql`

**Intent**: Tasks can exist without an origin meeting, and completing in a 1-on-1 records which meeting closed them.

**Contract**:

- `tasks.meeting_id` nullable (keep FK to `meetings(id)` ON DELETE RESTRICT)
- `tasks.completed_meeting_id` nullable FK → `meetings(id)` ON DELETE RESTRICT
- Index on `completed_meeting_id` (lookup for mixed meeting list). Existing `(manager_id, employee_id)` stays
- Backfill: `completed_meeting_id = meeting_id` where `completed_at IS NOT NULL` and `deleted_at IS NULL`
- Replace `soft_delete_meeting`: (1) soft-delete origin tasks (`meeting_id = param`); (2) `completed_meeting_id = null` on remaining live tasks stamped to that meeting; (3) soft-delete the meeting. Return boolean as today
- No RLS policy rewrite (ownership unchanged). Grant execute if the function is recreated with the same signature
- `soft_delete_employee` already deletes all tasks by `employee_id` — leave it

#### 2. Types and mappers

**File**: `src/types.ts`

**Intent**: DTO matches the Phase 1 UI fields.

**Contract**: `Task` / `TaskRow` / `toTask` include `meetingId`/`meeting_id` as `string | null` and `completedMeetingId`/`completed_meeting_id` as `string | null`.

#### 3. Tasks list and create

**File**: `src/pages/api/tasks.ts`

**Intent**: Employee-wide list for the overview; follow-up list for a meeting; floating create.

**Contract**:

- `GET`: exactly one of `employeeId` or `meetingId` (UUID). Both or neither → 400
- `GET ?employeeId=`: `{ tasks: Task[] }` for that employee (RLS hides other managers / soft-deleted)
- `GET ?meetingId=`: 404 if meeting missing; else tasks for that meeting’s `employee_id` where `completed_at IS NULL OR completed_meeting_id = meetingId`
- Sort: open first (`completed_at` nulls first), then `planned_date` (nulls last is fine), then `created_at` ascending — or document an equivalent stable order and use it on both surfaces
- `POST` body: `{ title, plannedDate?, meetingId?, employeeId? }` with refine: **at least one** of `meetingId` / `employeeId`; title required
- If `meetingId` present: load meeting (404 if missing); origin = that id; `employee_id` from meeting; if `employeeId` also sent and differs → 400
- If only `employeeId`: load employee (404 if missing); `meeting_id` null
- 201 `{ task: Task }`; `prerender = false`; 401/400/404/500 as elsewhere

#### 4. Task PATCH stamp

**File**: `src/pages/api/tasks/[id].ts`

**Intent**: Overview and meeting complete share one PATCH with different stamp behavior.

**Contract**:

- `updateTaskSchema` adds `completedMeetingId: z.uuid().nullable().optional()`
- Refine still requires at least one field (include the new key)
- If `completedAt` is `null`: set `completed_at = null` **and** `completed_meeting_id = null` (ignore a stale stamp in the same body)
- If `completedAt` is a timestamp: set `completed_at`; set `completed_meeting_id` only when `completedMeetingId` is present in the body (UUID → stamp, `null` → clear). Overview omits the key so a null stamp stays null
- Reject `completedMeetingId` without a completing `completedAt` in the same request unless the task is already completed and this is a stamp correction — **simpler allowed rule**: `completedMeetingId` is only honored when `completedAt` is also provided and non-null. Document that; meeting UI always sends both
- Title / plannedDate unchanged. DELETE unchanged (`soft_delete_task`)

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly (`npx supabase db reset` or migrate)
- `npm run lint` and `npm run build` pass
- Handlers still export `prerender = false` and uppercase methods

#### Manual Verification:

- `GET /api/tasks?employeeId=` returns floating + origin tasks; `GET ?meetingId=` returns open-for-employee + closed-here only
- `POST` with `employeeId` only creates `meetingId: null`; `POST` with `meetingId` still copies employee
- PATCH complete from a meeting with stamp; GET meeting list shows it as closed-here; PATCH `{ completedAt: null }` clears stamp
- PATCH `{ completedAt }` without `completedMeetingId` leaves stamp null
- Unauthenticated GET/POST/PATCH still 401
- Soft-delete a meeting: its origin tasks disappear; a floating task closed in that meeting remains on `GET ?employeeId=` with `completedMeetingId` null

**Implementation Note**: Pause before swapping the UI off the overlay.

---

## Phase 3: Persist & wire-up

### Overview

Both surfaces use the Phase 2 APIs as the only source of truth. Overlay and N+1 meeting-task fetches go away.

### Changes Required:

#### 1. Person overview → live employee tasks

**File**: `src/components/employees/PersonShell.tsx` (and person task panel)

**Intent**: Follow-up list and floating create persist across reload.

**Contract**: `GET /api/tasks?employeeId=`; Add `POST { employeeId, title, plannedDate? }`; complete omits `completedMeetingId`; no overlay reads/writes. Selector / read pane still use meetings GET + selected meeting object (already includes notes JSON — no extra GET required unless the list payload is later slimmed; if the list is heavy, `GET /api/meetings/[id]` for the selection is acceptable).

#### 2. Meeting capture → follow-up GET

**File**: `src/components/meetings/MeetingCapture.tsx`, `src/components/meetings/TasksPanel.tsx`

**Intent**: Capture side panel is the during-meeting view of the same person-task set.

**Contract**: Load `GET /api/tasks?meetingId=` (new mixed semantics). Add still `{ meetingId, title, plannedDate? }`. Complete sends `{ completedAt, completedMeetingId: meetingId }`. Uncomplete `{ completedAt: null }`. Props on `TasksPanel` must distinguish overview vs meeting complete behavior (e.g. optional `completeInMeetingId`).

#### 3. Remove overlay

**File**: `src/lib/person-task-overlay.ts` (delete) and purge imports

**Intent**: No dual source of truth after wire-up.

**Contract**: Repo has no sessionStorage person-task overlay; grep clean.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npm run build` pass
- No remaining imports of the overlay module

#### Manual Verification:

- Full loop: person page → add floating task → reload → still there with no origin → open newest meeting → task in open list → mark done → reload meeting → still closed here → person list shows it completed with a close hint
- Overview mark-done → reload → completed, `completedMeetingId` null, does not appear as closed-here on any meeting
- Uncomplete on the meeting page returns the task to the open list on both surfaces
- Newest default + `?meeting=` still work; expand boxes still read-only; Open meeting still edits on capture
- Create meeting still lands on capture; completed meeting still allows task toggle
- Soft-delete meeting: origin tasks gone; floating tasks remain
- Overlay-only Phase 1 rows are gone after reload (expected)

**Implementation Note**: This phase completes the change; run the end-to-end checklist below before marking implemented.

---

## Testing Strategy

### Unit Tests:

- None required — no test runner in repo yet (`AGENTS.md`)

### Integration Tests:

- None automated; use manual HTTP checks in Phase 2 and the UI loops in Phases 1 and 3

### Manual Testing Steps:

1. From the dashboard, open a person with at least two meetings (one open, one completed)
2. Confirm newest is selected; change selection; confirm `?meeting=` updates; refresh restores it
3. Expand/collapse topics, notes, observations, conclusions; confirm no toolbar and no edits persist
4. Open meeting → capture still autosaves / finalize works
5. Add a floating task on the overview (with and without planned date); complete it on the overview; reload
6. Add another floating task; complete it **inside** a meeting; confirm closed-here vs overview
7. Uncomplete from each surface
8. Add a task during capture (origin set); confirm it appears on the person list
9. Soft-delete a meeting that has origin tasks and a floating task closed there; confirm only origin tasks disappear
10. Narrow viewport: columns stack in selector → read pane → tasks order

## Performance Considerations

~20 reportees, small task counts: employee-scoped `GET` plus the existing `(manager_id, employee_id)` index is enough. Do not N+1 `GET ?meetingId=` after Phase 3. Four read-only TipTap instances on the overview — remount only on meeting change; keep collapsed `max-height` so off-screen wrap-up stays cheap. No FTS column.

## Migration Notes

- Additive / relaxing: `meeting_id` nullability + new nullable FK. Backfill close-stamps for already-completed origin tasks
- Rollback: stop sending new PATCH/POST keys; drop `completed_meeting_id`; restore `meeting_id` NOT NULL only if no floating rows exist (otherwise delete or attach those rows first)
- Phase 1 overlay is disposable; do not migrate sessionStorage into Supabase
- `soft_delete_meeting` signature stays `meeting_id_param uuid → boolean` so `DELETE /api/meetings/[id]` is unchanged

## References

- PRD US-01, FR-008–010: `context/foundation/prd.md`
- Roadmap S-04: `context/foundation/roadmap.md`
- Predecessors: `context/changes/meeting-capture-notes-tasks/plan.md`, `context/changes/finalize-meeting-note/plan.md`
- Tasks API: `src/pages/api/tasks.ts`, `src/pages/api/tasks/[id].ts`
- Person shell: `src/components/employees/PersonShell.tsx`
- Meeting tasks: `src/components/meetings/TasksPanel.tsx`, `src/components/meetings/MeetingCapture.tsx`
- Notes remount constraint: `src/components/meetings/NotesEditor.tsx`
- Cascade RPC: `supabase/migrations/20260810105659_create_meetings_and_tasks.sql`
- UI-first: `context/foundation/lessons.md`, `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Overview + meeting-panel shells

#### Automated

- [x] 1.1 `npm run lint` passes — 2a4df20
- [x] 1.2 `npm run build` passes — 2a4df20

#### Manual

- [x] 1.3 Person page is three columns on a wide viewport and stacks on a narrow one; newest meeting is selected; `?meeting=` selects that row — 2a4df20
- [x] 1.4 Read pane shows topics/notes/wrap-up in small boxes; expand reveals more; fields are not editable; Open meeting reaches capture — 2a4df20
- [x] 1.5 Add a task on the person page; open a meeting; the task appears in the open list; mark it done there; it stays on that meeting’s list as completed and remains on the person list — 2a4df20
- [x] 1.6 Mark a task done on the person page; it does not appear as closed-in a meeting — 2a4df20
- [x] 1.7 Create meeting still opens `/meetings/[id]` — 2a4df20
- [x] 1.8 Reload drops overlay-only floating tasks / stamps (expected until Phase 3) — 2a4df20

### Phase 2: Schema & API

#### Automated

- [x] 2.1 Migration applies cleanly (`npx supabase db reset` or migrate)
- [x] 2.2 `npm run lint` and `npm run build` pass
- [x] 2.3 Handlers still export `prerender = false` and uppercase methods

#### Manual

- [x] 2.4 `GET /api/tasks?employeeId=` returns floating + origin tasks; `GET ?meetingId=` returns open-for-employee + closed-here only
- [x] 2.5 `POST` with `employeeId` only creates `meetingId: null`; `POST` with `meetingId` still copies employee
- [x] 2.6 PATCH complete from a meeting with stamp; GET meeting list shows it as closed-here; PATCH `{ completedAt: null }` clears stamp
- [x] 2.7 PATCH `{ completedAt }` without `completedMeetingId` leaves stamp null
- [x] 2.8 Unauthenticated GET/POST/PATCH still 401
- [x] 2.9 Soft-delete a meeting: origin tasks disappear; a floating task closed in that meeting remains on employee GET with `completedMeetingId` null

### Phase 3: Persist & wire-up

#### Automated

- [ ] 3.1 `npm run lint` and `npm run build` pass
- [ ] 3.2 No remaining imports of the overlay module

#### Manual

- [ ] 3.3 Full loop: floating add → reload → complete in a meeting → reload both surfaces
- [ ] 3.4 Overview mark-done stays unstamped and is not closed-here on any meeting
- [ ] 3.5 Uncomplete on the meeting page returns the task to the open list on both surfaces
- [ ] 3.6 Newest default + `?meeting=` work; expand boxes read-only; Open meeting edits on capture
- [ ] 3.7 Create meeting still lands on capture; completed meeting still allows task toggle
- [ ] 3.8 Soft-delete meeting removes origin tasks only; floating tasks remain
- [ ] 3.9 Overlay-only Phase 1 rows are gone after reload
