# Person Overview and Task Follow-up — Plan Brief

> Full plan: `context/changes/person-overview-task-followup/plan.md`

## What & Why

Manager can open a person overview, select among that employee’s meetings, read the selected note, and mark tasks complete or add new ones (US-01 / FR-008–010 / S-04). Capture and finalize already work; without this slice, commitments stay trapped inside individual meeting pages — the original OneNote pain.

## Starting Point

`/employees/[id]` is a thin hub (create meeting + list that navigates away). Notes and tasks live only on `/meetings/[id]`. Tasks always belong to a meeting; `GET /api/tasks` is origin-`meetingId` only. Schema already denormalizes `employee_id` for this slice.

## Desired End State

Person page is a three-column follow-up surface: meeting selector, expandable read-only meeting fields, all person tasks. Overview adds are person-level (no origin meeting). Completing a task during a 1-on-1 stamps that meeting; completing on the overview does not. The meeting side panel shows every open person-task plus work closed in that meeting.

## Key Decisions Made

| Decision          | Choice                                             | Why (1 sentence)                                        | Source  |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------- | ------- |
| Layout            | Three columns: selector \| notes \| tasks          | FR-008 side panel + the 3-col shell S-02 deferred       | Plan    |
| Notes on overview | Read-only; edit on `/meetings/[id]`                | FR-009 is “read”; autosave/finalize stay on capture     | Plan    |
| Meeting fields    | Topics + notes + wrap-up in small expandable boxes | Full recall without a second editor                     | Plan    |
| Default selection | Newest meeting; `?meeting=` deep-link              | Matches existing list order; back from capture restores | Plan    |
| Task list         | All tasks for the person                           | Vision pain is commitments across notes                 | Plan    |
| Overview Add      | No origin meeting (floating)                       | Follow-up work is person-level until a 1-on-1 closes it | Plan    |
| Close model       | `completed_meeting_id` when done in a meeting      | Meeting panel can show open leftover + closed-here      | Plan    |
| Overview complete | `completedAt` only, no stamp                       | Between-meeting done is not “closed with this note”     | Plan    |
| Meeting Add       | Still sets origin `meetingId`                      | Live capture tasks remain born in that 1-on-1           | Plan    |
| Phase order       | UI-first → schema/API → persist                    | Project preference                                      | Lessons |

## Scope

**In scope:**

- Three-column person overview, expandable read pane, Open-meeting link
- Person-level tasks + close-in-meeting stamp; mixed meeting side panel
- Schema, GET/POST/PATCH, cascade tweak, backfill

**Out of scope:**

- Editing/finalize on the overview, voice, AI, task priority/assignee
- Offline queue, meeting-list split/filter, new Collapsible package

## Architecture / Approach

Evolve `PersonShell` into the overview. Reuse read-only `NotesEditor` (remount on meeting change). Generalize `TasksPanel` with overlay in Phase 1, then `GET ?employeeId=` / mixed `GET ?meetingId=` plus optional POST `meetingId`. `soft_delete_meeting` still deletes origin tasks and only clears stamps on floating rows.

## Phases at a Glance

| Phase                              | What it delivers                                                  | Key risk                                         |
| ---------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| 1. Overview + meeting-panel shells | Clickable 3-col overview + mixed list (session overlay)           | Overlay merge disagrees with later API semantics |
| 2. Schema & API                    | Nullable origin, close stamp, list/create/PATCH, cascade/backfill | Cascade wrongly deletes floating tasks           |
| 3. Persist & wire-up               | Live APIs on both surfaces; delete overlay                        | Meeting complete omits stamp → closed-here empty |

**Prerequisites:** S-02 capture + S-03 finalize working locally (Cloudflare + Supabase)  
**Estimated effort:** ~2–3 sessions across 3 phases

## Open Risks & Assumptions

- Phase 1 overlay is discarded on reload until Phase 3
- Existing completed tasks backfill `completed_meeting_id = meeting_id` so they still show as closed on their origin meeting
- Four TipTap instances on the overview stay acceptable at 1-on-1 length if collapsed by default

## Success Criteria (Summary)

- Manager opens a person, reads any meeting without leaving, and sees all of that person’s tasks
- A task added on the overview can be closed in a later meeting and then shows as closed-here
- A task marked done on the overview stays unstamped; capture/finalize on `/meetings/[id]` still works
