---
project: Manager Pad
version: 1
status: draft
created: 2026-07-24
updated: 2026-08-15
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Manager Pad

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Managers with ~20 reportees lose track of 1-on-1 commitments spread across unstructured notes. Manager Pad is a purpose-built web app for preparing meetings, capturing notes and tasks live, and following up from a person overview — without Notion-style DIY setup. Privacy stays manager-only; autosave and snappy navigation are launch guardrails.

## North star

**S-02: user can create a meeting note, take rich-text notes, and add dated tasks in the side panel** — the validation milestone (the smallest end-to-end slice that would prove the core live 1-on-1 hypothesis) under a speed bias with market-feedback coloring: ship the during-meeting capture loop before person-overview polish.

> Here, "north star" means the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as Prerequisites allow because everything else only matters if this works.

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                                                           | Prerequisites            | PRD refs                      | Status  |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------- | ------- |
| S-01 | create-team-and-employee      | create a team and an employee (name, role, single team) while logged in                        | existing auth (baseline) | FR-001, FR-002, FR-003        | done    |
| S-02 | meeting-capture-notes-tasks   | create a meeting note, prepare topics, take rich-text notes, add dated tasks in the side panel | S-01                     | FR-004, FR-005, FR-006        | done    |
| S-03 | finalize-meeting-note         | finalize a meeting with observations/conclusions and mark it complete                          | S-02                     | FR-007                        | done    |
| S-04 | person-overview-task-followup | open a person overview, select meetings, read notes, and mark or add tasks across meetings     | S-02, S-03               | US-01, FR-008, FR-009, FR-010 | ready   |
| S-05 | meeting-voice-notes           | record voice notes during a meeting                                                            | S-02                     | FR-012                        | blocked |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain                             | Note                                                                         |
| ------ | ------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| A      | Core 1-on-1 path    | `S-01` → `S-02` → `S-03` → `S-04` | Must-have path to Primary Success Criteria under `speed`.                    |
| B      | Live capture extras | `S-05`                            | Branches from `S-02`; parallel with `S-03` / `S-04` once scope is confirmed. |

## Baseline

What's already in place in the codebase as of `2026-07-24` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — Astro 6 + React 19 + Tailwind 4 + shadcn scaffold; product UI only auth/dashboard starter (`src/pages/`)
- **Backend / API:** present — Astro SSR + auth API routes (`src/pages/api/auth/*`) + middleware
- **Data:** partial — Supabase client wired; no product migrations/tables (`supabase/config.toml` only)
- **Auth:** present — Supabase cookie SSR + `/dashboard` protection (`src/middleware.ts`)
- **Deploy / infra:** partial — Cloudflare Workers + wrangler; CI lint/build only, no auto-deploy
- **Observability:** absent — no error tracking / metrics

## Foundations

(None — auth and API scaffold are present in baseline. Product tables and manager-only privacy policies land inside the first vertical slices that need them, not as a prebuilt data layer.)

## Slices

### S-01: Create team and employee

- **Outcome:** user can create a team and an employee record (name, role, single team assignment) while logged in
- **Change ID:** create-team-and-employee
- **PRD refs:** FR-001, FR-002, FR-003
- **Prerequisites:** existing auth (baseline)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Primary Success Criteria step 3 mentions multi-team assignment while FR-003 resolves single team for v1 — treat FR-003 as authoritative for this slice? — Owner: user. Block: no.
- **Risk:** Sequenced first because every later slice needs employees; introducing the first manager-owned tables here (not in a horizontal foundation) keeps the path vertical under `speed`.
- **Status:** done

### S-02: Meeting capture — notes and tasks

- **Outcome:** user can create a meeting note for an employee, prepare topics, take rich-text notes during the meeting, and create tasks with planned completion dates in the side panel
- **Change ID:** meeting-capture-notes-tasks
- **PRD refs:** FR-004, FR-005, FR-006
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** North star — placed as early as Prerequisites allow; autosave NFR must land with note/task edits here or the live-meeting guardrail fails.
- **Status:** done

### S-03: Finalize meeting note

- **Outcome:** user can add observations and conclusions to a meeting note and mark it complete
- **Change ID:** finalize-meeting-note
- **PRD refs:** FR-007
- **Prerequisites:** S-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kept separate from S-02 so capture stays shippable without finalize UI; completed status (not lock) matches FR-007 resolution.
- **Status:** done

### S-04: Person overview and cross-meeting tasks

- **Outcome:** user can open a person overview, select among that employee's meetings, read the selected note, and mark tasks complete or add new tasks from the side panel
- **Change ID:** person-overview-task-followup
- **PRD refs:** US-01, FR-008, FR-009, FR-010
- **Prerequisites:** S-02, S-03
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Delivers the Vision pain (commitments across meetings) one slice after the north star; sequenced after finalize so the Primary Success Criteria end-to-end flow is intact.
- **Status:** ready

### S-05: Voice notes during meeting

- **Outcome:** user can record voice notes during a meeting
- **Change ID:** meeting-voice-notes
- **PRD refs:** FR-012
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Does FR-012 remain must-have under `hard_deadline: 2026-08-31` and after-hours capacity, or should it move to Parked for v1? — Owner: user. Block: yes.
- **Risk:** Must-have in PRD but highest calendar risk under `top_blocker: time`; blocked until scope is confirmed so `/10x-plan` is not spent on a slice that may be deferred.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                     | Linear                                                  | Ready for `/10x-plan` | Notes                                         |
| ---------- | ----------------------------- | ----------------------------------------- | ------------------------------------------------------- | --------------------- | --------------------------------------------- |
| S-01       | create-team-and-employee      | Manager can create a team and employee    | [MAC-5](https://linear.app/maciej-zadworny/issue/MAC-5) | no                    | Implemented                                   |
| S-02       | meeting-capture-notes-tasks   | Meeting capture: notes + side-panel tasks | [MAC-6](https://linear.app/maciej-zadworny/issue/MAC-6) | no                    | Implemented (north star)                      |
| S-03       | finalize-meeting-note         | Finalize meeting with observations        | [MAC-7](https://linear.app/maciej-zadworny/issue/MAC-7) | no                    | Implemented                                   |
| S-04       | person-overview-task-followup | Person overview + cross-meeting tasks     | [MAC-8](https://linear.app/maciej-zadworny/issue/MAC-8) | yes                   | Run `/10x-plan person-overview-task-followup` |
| S-05       | meeting-voice-notes           | Voice notes during meeting                | [MAC-9](https://linear.app/maciej-zadworny/issue/MAC-9) | no                    | Blocked on must-have confirmation             |

Linear project: [Manager Pad](https://linear.app/maciej-zadworny/project/manager-pad-20207118e177). Sequencing stays in this file; board status is agent-synced via MCP (see `AGENTS.md` → Linear sync).

## Open Roadmap Questions

1. **What are the target `qps` and `data_volume` ballparks for `target_scale`?** — Owner: user. Block: roadmap-wide (non-blocking for first slices; matters for later scale/AI cost decisions).
2. **Primary flow step 3 vs FR-003:** Primary Success Criteria mentions multi-team assignment; FR-003 resolves single team per employee for v1. Which wording is authoritative for MVP? — Owner: user. Block: S-01 (soft — FR-003 is the working assumption).
3. **FR-011 privacy-preserving AI approach:** If AI summaries ship, what privacy model is acceptable? — Owner: user. Block: no for MVP path (nice-to-have; see Parked).
4. **Does FR-012 (voice notes) remain must-have under the hard deadline?** — Owner: user. Block: S-05.

## Parked

- **Reportee login / employee-facing portal** — Why parked: PRD §Non-Goals.
- **Full HR or performance-review suite** — Why parked: PRD §Non-Goals.
- **Real-time co-editing with employees** — Why parked: PRD §Non-Goals.
- **Offline-first / full mobile-native for v1** — Why parked: PRD §Non-Goals.
- **Custom LLM training** — Why parked: PRD §Non-Goals.
- **Calendar, Slack, or Teams integrations for v1** — Why parked: PRD §Non-Goals.
- **AI summary of past meetings (FR-011)** — Why parked: nice-to-have under `main_goal: speed` / `top_blocker: time`; privacy model still open before any later un-park.

## Done

(Empty on first generation. `/10x-archive` appends entries here when matching Change IDs are archived.)
