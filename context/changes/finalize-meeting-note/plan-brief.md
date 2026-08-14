# Finalize Meeting Note — Plan Brief

> Full plan: `context/changes/finalize-meeting-note/plan.md`

## What & Why

Manager can finalize a meeting note with observations and conclusions, and mark it complete (FR-007 / S-03). Capture (S-02) already works; without finalize, the primary 1-on-1 flow stops at live notes and never records the takeaway or a completed status for later person overview.

## Starting Point

Meeting page has topics, TipTap notes, task panel, and autosave. `status` is `"open"` only in types and PATCH; the DB column is unconstrained text. No wrap-up fields. Person list shows raw uppercase `OPEN`.

## Desired End State

On `/meetings/[id]`, two TipTap wrap-up editors sit under notes. Mark complete / Reopen appear in the header and at the bottom of wrap-up. Completed freezes notes, topics, date, and wrap-up until reopen; tasks stay editable. Person list shows Open or Completed. Wrap-up autosaves; complete flushes pending edits in one PATCH.

## Key Decisions Made

| Decision          | Choice                                                  | Why (1 sentence)                                                 | Source  |
| ----------------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ------- |
| Lock vs status    | Completed status, not a permanent lock                  | Socrates on FR-007                                               | PRD     |
| Wrap-up fields    | Two TipTap editors (observations + conclusions)         | Same formatting as live notes for a real wrap-up                 | Plan    |
| After complete    | Capture fields read-only until reopen                   | Finished write-up stays stable; reopen undoes mistakes           | Plan    |
| Wrap-up required? | Optional                                                | Speed; status is the lifecycle signal                            | Plan    |
| Reopen            | Allowed                                                 | Accidental complete must be cheap to undo                        | Plan    |
| Frozen surface    | Notes, topics, date, wrap-up; **tasks stay editable**   | S-04 follow-up must still work on completed meetings             | Plan    |
| Control placement | Mark complete / Reopen at **header and wrap-up bottom** | Complete after writing wrap-up _or_ after scrolling up to review | Plan    |
| Save timing       | Autosave wrap-up; complete = atomic snapshot + status   | Autosave NFR + no dropped keystrokes                             | Plan    |
| Person list       | One list; **Open** / **Completed** labels               | Status already rendered; S-04 owns filters                       | Plan    |
| Phase order       | UI-first → schema/API → persist                         | Project preference                                               | Lessons |

## Scope

**In scope:**

- Observations + conclusions TipTap fields
- Complete / reopen, soft lock, person-list labels
- Schema, PATCH, autosave flush, completed-write guard

**Out of scope:**

- S-04 person overview / selector / cross-meeting tasks
- Required wrap-up, confirm dialog, list split/filter
- Voice notes, AI, new finalize endpoint

## Architecture / Approach

Reuse `NotesEditor` (`editable` + `setEditable`, no remount). Extend `PATCH /api/meetings/[id]` with wrap-up JSON and `status: open \| completed`. Complete cancels debounce and PATCHes current snapshot + `completed` in one request; API returns 409 if content is written while completed without `status: "open"`. Tasks APIs unchanged.

## Phases at a Glance

| Phase                       | What it delivers                                           | Key risk                                                 |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 1. Finalize UI shell        | Clickable wrap-up + complete/reopen + freeze (local state) | Three TipTap instances / read-only without remount       |
| 2. Schema & API             | jsonb columns, CHECK, PATCH + 409 guard                    | Guard too weak → late autosave overwrites completed data |
| 3. Persist, autosave, flush | Real save; atomic complete; person list Completed          | Flush missed → last wrap-up characters dropped           |

**Prerequisites:** S-02 capture working locally (Cloudflare + Supabase)  
**Estimated effort:** ~2 sessions across 3 phases

## Open Risks & Assumptions

- Soft lock is a stricter reading of FR-007 than “status not lock”; reopen keeps it reversible
- Phase 1 local complete/wrap-up is discarded on reload until Phase 3
- S-04 can assume completed meetings still accept task writes

## Success Criteria (Summary)

- Manager writes wrap-up, marks complete from header or bottom, reloads: frozen and persisted
- Reopen restores editing; empty wrap-up can still complete
- Tasks remain usable on a completed meeting; person list shows Open vs Completed
