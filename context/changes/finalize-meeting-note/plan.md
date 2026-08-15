# Finalize Meeting Note Implementation Plan

## Overview

Ship roadmap S-03 (FR-007): on an existing meeting, the manager writes observations and conclusions in two TipTap fields, marks the meeting complete, and can reopen it to edit again. Completed freezes capture fields (not tasks). Phases are **UI-first**, then schema + API, then persistence.

## Current State Analysis

S-02 capture is live: `/meetings/[id]` has topics, TipTap notes, dated tasks, and 600ms autosave. Person shell lists meetings with a raw uppercase `status` label. Finalize does not exist.

- `MeetingStatus` and PATCH zod are `"open"` only (`src/types.ts`, `src/pages/api/meetings/[id].ts`). DB `meetings.status` is unconstrained `text` default `'open'` — no CHECK.
- No `observations` / `conclusions` columns, DTO fields, or UI.
- `useMeetingAutosave` PATCHes only `topics`, `meetingDate`, `notesJson`.
- `NotesEditor` has no `editable` prop; `useEditor` is created once (empty deps) with `immediatelyRender: false`.
- FR-007 already chose completed **status** over a permanent lock. This slice adds a **soft lock**: read-only until reopen.

### Key Discoveries:

- Meeting PATCH already exists — extend it; do not add a separate `/finalize` route (`src/pages/api/meetings/[id].ts`)
- Person list already renders `meeting.status` (`src/components/employees/PersonShell.tsx`) — Completed will show once the API returns it
- TipTap v3 + `immediatelyRender: false` is required under Astro SSR; three editors (notes + two wrap-up) must keep that contract
- Late autosave after complete is a real race: debounce can fire after status flips unless Complete sends an atomic content+status PATCH and the API rejects content writes while completed

## Desired End State

A logged-in manager can:

1. Open an existing meeting and see an Observations editor and a Conclusions editor (same TipTap toolkit as notes) below the notes
2. Autosave wrap-up without a manual Save button
3. Mark the meeting complete from **both** the header and the wrap-up section (empty wrap-up allowed)
4. After complete: notes, topics, meeting date, and wrap-up are read-only; tasks remain addable/editable/completable; soft-delete still works
5. Reopen from the same two places; capture fields become editable again
6. On the person meeting list, see **Open** or **Completed** (title case, one list, date order unchanged)

Verify: complete → reload → still completed and frozen; reopen → edit wrap-up → complete again; kill network during complete → error + Retry; tasks still work while completed.

## What We're NOT Doing

- Person-overview polish, meeting selector, cross-meeting task panel (S-04)
- Split Open/Completed list sections or filters
- Permanent lock (no reopen) or required wrap-up text
- Confirm dialog on complete
- Voice notes (S-05), AI summaries (FR-011)
- Hard-delete; changing soft-delete cascade
- Offline queue or multi-tab merge
- New API resource — status + wrap-up stay on `PATCH /api/meetings/[id]`

## Implementation Approach

Three phases, UI-first (`lessons.md`):

1. Clickable finalize on the live meeting page with **component state** for wrap-up + status (reload reverts until Phase 3). Person list copy: **Open** instead of `OPEN`.
2. Migration + DTO/API: two jsonb columns, `open | completed` CHECK, PATCH fields, completed-write guard.
3. Wire autosave + atomic complete/reopen; drop the Phase 1 local overlay.

Shared contract (pin in Phase 1, persist in Phase 2):

| Field              | Type                    | Notes                                              |
| ------------------ | ----------------------- | -------------------------------------------------- |
| `observationsJson` | `NotesJson`             | Empty doc = `EMPTY_NOTES_DOC`; never `null` / `{}` |
| `conclusionsJson`  | `NotesJson`             | Same                                               |
| `status`           | `"open" \| "completed"` | Create still inserts `"open"`                      |

## Critical Implementation Details

**Complete is one PATCH, not status-then-hope.** Mark complete must cancel debounce timers and `PATCH` the current snapshot (`topics`, `meetingDate`, `notesJson`, `observationsJson`, `conclusionsJson`, `status: "completed"`) in a **single** request. Reopen PATCHes `status: "open"`. If that request fails, do not freeze (or unfreeze) locally; show the existing error banner + Retry, and Retry resends the same snapshot + intended status.

**API completed-write guard.** While the row is `completed`, reject PATCHes that change content fields unless the same body sets `status: "open"`. A content-only PATCH against a completed meeting is `409` (or `400` with a clear error). This blocks a late autosave from un-freezing data after the UI looks done.

**Read-only without remounting TipTap.** Add `editable` to `NotesEditor` and call `editor.setEditable()` when it changes. Do not remount the editor on complete/reopen (that fights selection and can `setContent` over in-progress JSON). Hide the toolbar when not editable. Wrap-up editors should be shorter than notes (smaller min-height), same extensions.

---

## Phase 1: Finalize UI shell

### Overview

Managers can click through wrap-up, complete, reopen, and frozen capture fields on `/meetings/[id]` before any migration. Status/wrap-up live in React state on top of the fetched meeting.

### Changes Required:

#### 1. Notes editor read-only + reuse

**File**: `src/components/meetings/NotesEditor.tsx`

**Intent**: Support three editors on the meeting page and freeze them when the meeting is completed, without a second editor implementation.

**Contract**: Optional `editable` (default `true`) and optional className/min-height for wrap-up. `immediatelyRender: false` unchanged. Toolbar hidden or inert when `editable` is false. `setEditable` on prop change; do not recreate the editor.

#### 2. Meeting capture finalize chrome

**File**: `src/components/meetings/MeetingCapture.tsx`

**Intent**: Add wrap-up and complete/reopen so the post-meeting step is visible and testable in the existing two-column layout.

**Contract**:

- Observations + Conclusions `NotesEditor`s in a wrap-up section **below notes** (left column, above the fold’s end; tasks stay in the right column)
- **Mark complete** / **Reopen** in the **header** (near date / save indicator) **and** at the **bottom of the wrap-up section** — same handler
- Empty wrap-up allowed
- When local status is `completed`: disable date + topics; pass `editable={false}` to notes + wrap-up editors; tasks panel unchanged; delete still available
- Header shows a clear Open/Completed label
- Phase 1: complete/reopen/wrap-up are local state only (reload loses them)

#### 3. Person list status copy

**File**: `src/components/employees/PersonShell.tsx`

**Intent**: Stop showing raw uppercase `OPEN`; prepare the list for a second status value.

**Contract**: Display **Open** or **Completed** from `meeting.status` (title case). One list, existing date sort. No filter/sections.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Meeting page shows Observations and Conclusions editors under notes; both header and wrap-up section have Mark complete
- Mark complete freezes date, topics, notes, wrap-up; tasks still add/toggle/delete; both controls become Reopen
- Reopen unlocks those fields again; both controls become Mark complete
- Person list shows **Open** (not `OPEN`)
- Reload still loses wrap-up/complete (expected until Phase 3)

**Implementation Note**: Pause for manual UX confirmation before Phase 2.

---

## Phase 2: Schema & API

### Overview

Persist wrap-up JSON and `completed` status with a CHECK constraint and a PATCH guard so the UI contract cannot be bypassed.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_meeting_finalize.sql`

**Intent**: Store observations/conclusions like notes and constrain status to the two UI values.

**Contract**:

- `observations_json jsonb not null default` empty TipTap doc (same JSON as `notes_json` / `EMPTY_NOTES_DOC`)
- `conclusions_json jsonb not null` with the same default
- `CHECK (status in ('open', 'completed'))` — existing rows are `'open'`, so this applies cleanly
- No RLS/RPC changes (ownership and soft-delete already cover updates)

#### 2. Types and mappers

**File**: `src/types.ts`

**Intent**: DTO matches the Phase 1 UI fields.

**Contract**: `MeetingStatus = "open" | "completed"`. `Meeting` / `MeetingRow` / `toMeeting` include `observationsJson` / `observations_json` and `conclusionsJson` / `conclusions_json`. Empty docs never `null`.

#### 3. PATCH (and create defaults)

**Files**: `src/pages/api/meetings/[id].ts`, `src/pages/api/meetings.ts` (create unchanged except DB defaults cover new columns)

**Intent**: Accept wrap-up + `completed`; refuse content edits on a completed meeting unless reopening.

**Contract**:

- `updateMeetingSchema`: `observationsJson?`, `conclusionsJson?` (same loose TipTap object as `notesJson`); `status: z.enum(["open", "completed"]).optional()`
- Refine still requires at least one field
- Load current row before update. If `status === "completed"` and the body does **not** set `status: "open"`, and any of `meetingDate` / `topics` / `notesJson` / `observationsJson` / `conclusionsJson` is present → **409** with a stable error string (e.g. reopen required)
- Reopen: `status: "open"` allowed (content fields optional in the same request)
- Complete: `status: "completed"` allowed while open, including combined content+status
- POST create stays `status: "open"`; new columns use DB defaults
- `prerender = false`; 401/400/404/409/500 as elsewhere

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly (`npx supabase db reset` or migrate)
- `npm run lint` and `npm run build` pass
- Handlers still export `prerender = false` and uppercase methods

#### Manual Verification:

- Authenticated PATCH `{ status: "completed" }` then GET shows `completed` and empty wrap-up docs
- PATCH content fields while completed returns 409; PATCH `{ status: "open" }` then content PATCH succeeds
- Unauthenticated PATCH still 401
- Studio: CHECK rejects `status = 'locked'` (or any third value)

**Implementation Note**: Pause before swapping the UI off local overlay.

---

## Phase 3: Persist, autosave, flush

### Overview

Wrap-up joins the existing autosave NFR. Complete/Reopen use the atomic PATCH + guard from Phase 2. Local-only status/wrap-up goes away.

### Changes Required:

#### 1. Extend autosave

**File**: `src/components/hooks/useMeetingAutosave.ts`

**Intent**: Persist observations/conclusions like notes, and give Complete a flush that cannot lose the last keystrokes.

**Contract**: Add `observationsJson` and `conclusionsJson` to `MeetingAutosaveFields` with the same 600ms debounce / generation token / Saved-on-2xx / Retry / unmount flush behavior. Export a `flush()` (or equivalent) that clears pending timers and PATCHes the **current** snapshot (not a stale closure). Retry includes wrap-up fields.

#### 2. Wire MeetingCapture to API status

**File**: `src/components/meetings/MeetingCapture.tsx`

**Intent**: Load wrap-up + status from GET; complete/reopen persist; freeze follows **server** status after 2xx.

**Contract**:

- Seed editors and autosave from `meeting.observationsJson` / `conclusionsJson` / `status`
- Complete: `flush` then PATCH snapshot + `status: "completed"` (or one combined PATCH of snapshot+status). Freeze only after 2xx. Failure → existing banner + Retry (Retry resends snapshot + completed)
- Reopen: PATCH `status: "open"`; enable editors after 2xx
- Do not autosave content while completed (skip `schedule` when frozen)
- No Phase 1 local-only overlay left

#### 3. Person list completed

**File**: `src/components/employees/PersonShell.tsx`

**Intent**: Completed meetings are visible in the existing list after reload.

**Contract**: GET `/api/meetings?employeeId=` already returns `status`; label **Open** / **Completed**. No extra fetch.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npm run build` pass
- No leftover Phase 1 “local-only complete” comments or unused overlay helpers

#### Manual Verification:

- Full loop: write wrap-up → Saved → Mark complete (header or bottom) → reload → still completed, editors read-only, wrap-up intact
- Reopen → edit conclusions → complete again → reload holds the edit
- Complete with empty wrap-up allowed; empty docs persist
- Tasks add/toggle while the meeting is completed; date/topics/notes/wrap-up stay frozen
- DevTools offline on Complete → error + Retry; after Retry, status is completed
- Person list shows **Completed** for that meeting among open ones, date order unchanged
- Late typing then immediate Complete does not drop the last characters (flush)

**Implementation Note**: This phase completes the change; run the end-to-end checklist below before marking implemented.

---

## Testing Strategy

### Unit Tests:

- None required — no test runner in repo yet (`AGENTS.md`)

### Integration Tests:

- None automated; use manual HTTP checks in Phase 2 and the UI loop in Phase 3

### Manual Testing Steps:

1. Open an existing meeting; confirm notes/tasks still work
2. Type observations and conclusions (heading, list); wait for Saved; hard-refresh (after Phase 3)
3. Mark complete from the **header**; confirm freeze; confirm bottom control is Reopen
4. Reopen from the **wrap-up section**; edit; complete from the bottom control
5. Complete with blank wrap-up; reload; still completed
6. While completed, add and toggle a task; confirm it persists; confirm notes cannot be edited
7. Soft-delete still returns to the person page
8. Person list: **Open** vs **Completed** labels
9. Offline Complete → Retry

## Performance Considerations

Three TipTap instances on one page — acceptable for 1-on-1 length. Keep wrap-up min-height smaller than notes. Autosave debounce stays ≥500ms; complete’s extra snapshot PATCH is rare. No FTS column.

## Migration Notes

- Additive columns with defaults; no backfill script (existing meetings get empty wrap-up docs)
- CHECK on `status` is safe: all current rows are `'open'`
- Rollback: drop CHECK, drop the two columns; clients that send new PATCH keys would 400 until reverted
- Phase 1 local state is disposable; do not migrate it

## References

- PRD FR-007: `context/foundation/prd.md`
- Roadmap S-03: `context/foundation/roadmap.md`
- Predecessor: `context/changes/meeting-capture-notes-tasks/plan.md`
- Autosave: `src/components/hooks/useMeetingAutosave.ts`
- Meeting PATCH: `src/pages/api/meetings/[id].ts`
- UI-first: `context/foundation/lessons.md`, `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Finalize UI shell

#### Automated

- [x] 1.1 `npm run lint` passes — a3ece00
- [x] 1.2 `npm run build` passes — a3ece00

#### Manual

- [x] 1.3 Meeting page shows Observations and Conclusions editors under notes; both header and wrap-up section have Mark complete — a3ece00
- [x] 1.4 Mark complete freezes date, topics, notes, wrap-up; tasks still add/toggle/delete; both controls become Reopen — a3ece00
- [x] 1.5 Reopen unlocks those fields again; both controls become Mark complete — a3ece00
- [x] 1.6 Person list shows Open (not OPEN) — a3ece00
- [x] 1.7 Reload still loses wrap-up/complete (expected until Phase 3) — a3ece00

### Phase 2: Schema & API

#### Automated

- [x] 2.1 Migration applies cleanly (`npx supabase db reset` or migrate) — 091546f
- [x] 2.2 `npm run lint` and `npm run build` pass — 091546f
- [x] 2.3 Handlers still export `prerender = false` and uppercase methods — 091546f

#### Manual

- [x] 2.4 Authenticated PATCH `{ status: "completed" }` then GET shows `completed` and empty wrap-up docs — 091546f
- [x] 2.5 PATCH content fields while completed returns 409; PATCH `{ status: "open" }` then content PATCH succeeds — 091546f
- [x] 2.6 Unauthenticated PATCH still 401 — 091546f
- [x] 2.7 Studio: CHECK rejects a third status value — 091546f

### Phase 3: Persist, autosave, flush

#### Automated

- [x] 3.1 `npm run lint` and `npm run build` pass — fa9d163
- [x] 3.2 No leftover Phase 1 local-only complete overlay — fa9d163

#### Manual

- [x] 3.3 Full loop: wrap-up Saved → Mark complete → reload frozen and intact — fa9d163
- [x] 3.4 Reopen → edit → complete again → reload holds the edit — fa9d163
- [x] 3.5 Complete with empty wrap-up allowed; empty docs persist — fa9d163
- [x] 3.6 Tasks work while completed; capture fields stay frozen — fa9d163
- [x] 3.7 Offline Complete → error + Retry; after Retry, status is completed — fa9d163
- [x] 3.8 Person list shows Completed for that meeting; date order unchanged — fa9d163
- [x] 3.9 Late typing then immediate Complete does not drop the last characters — fa9d163
