---
project: Manager Pad
context_type: greenfield
created: 2026-07-09
updated: 2026-07-09
product_type: web-app
target_scale:
  users: large
  qps: null
  data_volume: null
timeline_budget:
  mvp_weeks: 5
  hard_deadline: 2026-08-31
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: pain category
      decision: workflow friction — too many notes across ~20 reportees, hard to navigate at the right moment
    - topic: insight
      decision: many tools can do this if you configure them (e.g. Notion), but few offer a purpose-built 1-on-1 manager workflow out of the box
    - topic: primary persona scope
      decision: single manager (self first) with ~20 reportees
    - topic: access control
      decision: login (email + password / OAuth); flat user model — one manager account, reportees are data not users
  frs_drafted: 12
  quality_check_status: accepted
---

## Vision & Problem Statement

A manager with ~20 reportees accumulates notes from many 1-on-1 meetings that become difficult to navigate. OneNote — the current tool — provides no proper structure for a 1-on-1 format. When the manager writes down tasks an employee should complete, there is no way to see those commitments across multiple notes between meetings. There is also no AI implementation to help summarize what has been discussed between sessions.

Many tools can approximate this workflow if you set them up yourself (e.g. Notion), but few offer a specific, purpose-built solution for the manager 1-on-1 workflow. General-purpose note apps grow to fulfill many applications, shifting the setup burden onto the manager.

**Scale note:** At thousands of users, recall and summaries must work with years of meeting history per employee; AI summary costs may require tiering or limits.

## User & Persona

**Primary persona:** The manager themselves — a line manager with approximately 20 direct reports who runs regular 1-on-1s.

**Context:** They currently use OneNote for meeting notes and need structure that OneNote does not provide.

**Moment they reach for this product:** Preparing for an upcoming 1-on-1, during the meeting when capturing notes and action items, and between meetings when following up on commitments made across prior sessions.

## Access Control

Login required (email + password or OAuth).

Flat user model: one manager account. Reportees are records in the system, not separate user accounts. No role separation for MVP.

## Success Criteria

### Primary

The manager can complete this end-to-end flow:

1. Log in
2. Create a team (folder for employees)
3. Create an employee record — name, role, assign to team(s) if in multiple teams
4. Create a meeting note — prepare topics to discuss
5. Hold the meeting — take notes; create tasks in the side panel (with planned completion date)
6. Finalize the meeting — add observations and conclusions; mark the note complete
7. In the person overview — use a meeting selector, view task list in the side panel, read notes, mark tasks complete or add new ones

### Secondary

AI summary of past meetings for a reportee — a digest of what was discussed between sessions.

### Guardrails

- Notes and tasks are private to the logged-in manager only
- Navigation remains usable with ~20 reportees (person overview, meeting selector, task list)
- Note content autosaves — no manual save required; nothing is lost when the manager jumps between tabs or takes long breaks

## Timeline acknowledgment

Acknowledged on 2026-07-09: 4–6-week MVP (estimated 5 weeks) requires sustained dedication; user accepted after scoping discussion (teams retained in v1).

## Functional Requirements

### Teams & employees

- FR-001: Manager can log in. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-002: Manager can create a team (folder for employees). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-003: Manager can create an employee record with name, role, and team assignment. Priority: must-have
  > Socrates: Counter-argument considered: multi-team assignment is rare YAGNI for v1. Resolution: single team per employee for v1; multi-team deferred.

### Meeting lifecycle

- FR-004: Manager can create a meeting note and prepare topics to discuss. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-005: Manager can take rich-text notes during a meeting. Priority: must-have
  > Socrates: Counter-arguments considered: plain text may be too weak; typing during 1-on-1s is awkward. Resolution: rich text required for v1; voice notes split to FR-012.
- FR-006: Manager can create tasks in the side panel of a meeting note, with a planned completion date. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-007: Manager can finalize a meeting note with observations and conclusions, and mark it complete. Priority: must-have
  > Socrates: Counter-argument considered: locking notes is overkill. Resolution: completed status replaces lock for v1.
- FR-012: Manager can record voice notes during a meeting. Priority: must-have
  > Socrates: Counter-argument considered: voice may duplicate rich-text notes. Resolution: kept; voice supports hands-free capture during live 1-on-1s.

### Person overview & tasks

- FR-008: Manager can view a person overview with a meeting selector and task list in the side panel. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-009: Manager can read meeting notes from the person overview. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-010: Manager can mark tasks complete or add new tasks from the person overview. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### AI (secondary)

- FR-011: Manager can receive an AI summary of past meetings for a reportee. Priority: nice-to-have
  > Socrates: Counter-argument considered: sending notes to an external AI API may conflict with the privacy guardrail. Resolution: kept as nice-to-have; must use a privacy-preserving approach (e.g. on-device or explicit consent) if implemented.

## User Stories

### US-01: Manager completes a 1-on-1 and tracks tasks across meetings

- **Given** a logged-in manager with at least one employee and one prior meeting note
- **When** they open the person overview, navigate between meetings, and mark a task complete
- **Then** they see the task status updated and can read notes from any selected meeting

#### Acceptance Criteria

- Task completion persists across sessions
- Meeting selector shows all meetings for that employee
- Notes from the selected meeting are readable in the overview

## Business Logic

The app structures every manager and employee interaction to make following up on commitments and progress easier.

**Inputs:** Preparation topics for discussion, live notes, tasks with dates, and observations.

**Output:** Open tasks across meetings, an overview of meetings, and a summary of main topics discussed and main observations.

**Where the user encounters it:** During a meeting that follows one or more previous meetings — when the manager needs to easily recall what was discussed earlier with that employee.

## Non-Functional Requirements

- Note and task edits persist continuously as the manager works, without requiring manual save actions or interrupting the flow
- Navigation between employees and meeting notes feels immediate from the user's perspective — no noticeable delay when moving between people and notes
- Notes and tasks remain private to the logged-in manager only

## Non-Goals

- **Avoid reportee login / employee-facing portal** — MVP is manager-only; reportees are records, not users.
- **Avoid a full HR or performance-review suite** — focused on 1-on-1 notes and follow-up, not ratings or reviews.
- **Avoid real-time co-editing with employees** — notes are manager-authored; no shared live editing.
- **Avoid offline-first / full mobile-native for v1** — web app first; offline and native mobile deferred.
- **Avoid building our own LLM** — if AI summaries ship, use external AI with privacy constraints; no custom model training.
- **Avoid calendar, Slack, or Teams integrations for v1** — standalone workflow first; integrations deferred.

