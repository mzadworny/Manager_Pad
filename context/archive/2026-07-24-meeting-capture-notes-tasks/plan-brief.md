# Meeting Capture Notes & Tasks — Plan Brief

> Full plan: `context/changes/meeting-capture-notes-tasks/plan.md`

## What & Why

Ship S-02 (north star): create a meeting for an employee, prepare topics, take rich-text notes, and manage tasks in a side panel during a live 1-on-1 — with autosave and manager-only privacy. Proves the core capture hypothesis before finalize (S-03) and person-overview polish (S-04).

## Starting Point

Dashboard teams/employees CRUD exists (manager RLS, soft-delete). No person page, meetings/tasks tables, rich-text editor, or autosave. APIs follow JSON + zod; UI is React islands on Astro SSR.

## Desired End State

Manager opens a thin person shell from the dashboard, creates a dated meeting, edits topics + TipTap notes, and CRUD/completes tasks in a two-column side panel. Edits autosave (Saved / error+Retry). Soft-deleting an employee cascades to meetings and tasks.

## Key Decisions Made

| Decision           | Choice                                                             | Why (1 sentence)                                        |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------- |
| Scope vs S-03/S-04 | Capture + task done/undone; no finalize UI; thin person shell only | Keeps north star shippable without pulling later slices |
| Entry              | Employee → person shell → meeting                                  | Avoids stranded past meetings before S-04               |
| Topics             | Separate plain-text field                                          | Prep distinct from live notes (FR-004)                  |
| Meeting create     | Explicit create + editable date (default today)                    | Clear lifecycle; supports later selectors               |
| Notes storage      | TipTap `notes_json` jsonb                                          | Faithful round-trip for headings/checklists             |
| Editor depth       | Bold/italic/lists/links/headings + note checklists                 | Useful in-meeting structure without Notion scope        |
| Autosave           | Debounce + Saved-on-2xx + error banner/Retry                       | Live-meeting guardrail under Workers latency            |
| Tasks              | Title + optional date + `completed_at` + soft-delete               | Done/undone + S-04-ready identity                       |
| Employee delete    | Cascade soft-delete meetings/tasks                                 | No zombie data                                          |
| Layout             | Two-column meeting page (not 3-col)                                | FR-006 side panel without S-04 shell                    |
| Status             | Column default `open`; no complete UI                              | Forward-compat for S-03                                 |
| Phase order        | UI-first → schema → API → persist                                  | Project preference for early manual testing             |

## Scope

**In scope:**

- Person shell + meeting capture UI (TipTap, topics, task panel)
- `meetings` / `tasks` schema, RLS, soft-delete RPCs + employee cascade
- JSON APIs + debounced autosave with retry
- `status = open` seed only

**Out of scope:**

- Finalize observations/complete (S-03)
- Cross-meeting person overview (S-04), voice notes, AI
- Offline queue, FTS `notes_text`, task priority/assignee

## Architecture / Approach

UI-first vertical slice: sessionStorage mock + TipTap islands → Supabase tables/RLS/RPCs → `/api/meetings` & `/api/tasks` → replace mock with fetch/autosave. Ownership mirrors S-01 (`manager_id` + RLS). Tasks denormalize `employee_id` for later cross-meeting lists.

## Phases at a Glance

| Phase                 | What it delivers                        | Key risk                                        |
| --------------------- | --------------------------------------- | ----------------------------------------------- |
| 1. Capture UI shells  | Clickable loop with sessionStorage mock | Mock contract must match later API DTOs         |
| 2. Schema & RLS       | Tables + cascade soft-delete RPCs       | Cascade bugs orphan or over-delete rows         |
| 3. API & types        | JSON CRUD + mappers                     | Zod/status-code drift from S-01 patterns        |
| 4. Persist & autosave | Live save + Retry; remove mock          | Cursor jump / stale overwrite if autosave wrong |

**Prerequisites:** Auth + employees working; local Supabase for Phases 2–4  
**Estimated effort:** ~3–4 sessions across 4 phases

## Open Risks & Assumptions

- Phase 1 sessionStorage data is disposable (not migrated)
- Optional task dates soften FR-006 wording (“with a date” → when provided)
- Autosave RTT on Cloudflare + remote Supabase may feel slow — debounce + Retry mitigate

## Success Criteria (Summary)

- Manager completes dashboard → person → meeting → notes + tasks without a Save button
- Reload keeps topics, notes JSON, and tasks; failed save is recoverable via Retry
- Soft-delete employee removes their meetings/tasks from the UI
