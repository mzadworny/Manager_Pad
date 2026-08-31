---
project: Manager Pad
version: 2
status: active
created: 2026-08-31
updated: 2026-08-31
prd_version: 2
main_goal: speed
top_blocker: time
milestone_id: landing-and-login-into-app
milestone_seq: 2
milestone_status: open
---

# Roadmap: Manager Pad

> Derived from `context/foundation/prd-v2.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: Selling landing and login into the app** — Status: open

- **Intent:** Replace the starter public page with an honest selling landing page, and make login enter the product — not “the dashboard” and not the public page.
- **Source materials:** `context/foundation/prd-v2.md` (v2)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** US-01 (must-have: what the app is / problems it solves; signup from the landing page; log in to the app; post-login lands in the app; session and team/people/meetings preserved)

## Vision recap

A visitor (or anyone sharing the URL) cannot tell what Manager Pad is: the public page is still the starter. Login is framed as entering “the dashboard,” and after sign-in you land back on that starter page instead of in the app. The product is now real enough to sell — an honest landing page plus login-into-the-app is enough; polished marketing is not required.

## North star

**S-01: visitor can read what the app is and which problems it solves, and can sign up or log in to the app from the public page** — the validation milestone (the smallest end-to-end slice that would prove the core “product is real enough to sell” hypothesis) under a speed bias: ship an honest selling page before post-login destination polish.

> Here, "north star" means the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as Prerequisites allow because everything else only matters if this works.

## At a glance

| ID   | Change ID            | Outcome (user can …)                                                                                      | Prerequisites | PRD refs | Status |
| ---- | -------------------- | --------------------------------------------------------------------------------------------------------- | ------------- | -------- | ------ |
| S-01 | selling-landing-page | read what the app is and which problems it solves on the public page, and reach existing signup or log in | —             | US-01    | done   |
| S-02 | login-lands-in-app   | log in to the app (not “the dashboard”) and land in the app, not on the public page                       | —             | US-01    | ready  |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain  | Note                                                               |
| ------ | ------------------- | ------ | ------------------------------------------------------------------ |
| A      | Selling the product | `S-01` | North star under `speed`; honest copy, not a marketing campaign.   |
| B      | Entering the app    | `S-02` | Parallel with S-01; existing-manager path; no data or schema work. |

## Baseline

What's already in place in the codebase as of `2026-08-31` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — product UI for teams, people, and meetings; public `/` is still the starter Welcome (`src/pages/index.astro`)
- **Backend / API:** present — SSR + product APIs for teams, employees, meetings, tasks, and auth
- **Data:** present — product tables and manager-only policies landed in M-1; this milestone needs no schema change
- **Auth:** present — cookie sessions; `/dashboard`, `/employees`, `/meetings` gated; sign-in currently redirects to `/` (`src/pages/api/auth/signin.ts`)
- **Deploy / infra:** partial — Cloudflare Workers + wrangler; CI is lint/build only
- **Observability:** absent — no error tracking / metrics

## Foundations

(None — auth, session, and the app home already exist. Post-login destination is user-visible work in S-02, not a prebuilt auth layer.)

## Slices

### S-01: Selling landing page

- **Outcome:** visitor can read what the app is and which problems it solves on the public main page, and can reach existing signup or log in to the app from that page
- **Change ID:** selling-landing-page
- **PRD refs:** US-01
- **Prerequisites:** —
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** North star under `speed` / `time` — honest copy is enough; blocking on polished marketing would miss the one-week after-hours budget.
- **Status:** done

### S-02: Login lands in the app

- **Outcome:** user can log in to the app (not “the dashboard”) and land in the app after login, not on the public page; existing session and team/people/meetings stay unchanged
- **Change ID:** login-lands-in-app
- **PRD refs:** US-01
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:**
  - If a signed-in user later opens the public URL, should they be sent into the app or still see the landing page? — Owner: user. Block: no (login redirect alone satisfies the primary flow; `/10x-plan` can pick a default).
- **Risk:** Kept separate from S-01 so the selling page can ship without waiting on destination/wording; blast radius is the login path only — in-app “dashboard” labels stay parked as polish.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID            | Suggested issue title                       | Ready for `/10x-plan` | Notes                                       |
| ---------- | -------------------- | ------------------------------------------- | --------------------- | ------------------------------------------- |
| S-01       | selling-landing-page | Selling landing page (replace the starter)  | yes                   | Run `/10x-plan selling-landing-page`        |
| S-02       | login-lands-in-app   | Login lands in the app, not the public page | yes                   | Parallel with S-01; login-path wording only |

Linear project: [Manager Pad](https://linear.app/maciej-zadworny/project/manager-pad-20207118e177). Sequencing stays in this file; board status is agent-synced via MCP (see `AGENTS.md` → Linear sync).

## Open Roadmap Questions

1. **What is the key architecture of the current system?** — Owner: user. Block: no (prd-v2: does not block this change; core functionality is captured).

## Parked

- **How the app works on the landing page** — Why parked: prd-v2 nice-to-have; under `main_goal: speed` / `top_blocker: time` the must-have is what the app is and which problems it solves.
- **In-app UX polish** (person entry on the team list, meeting-note icon, person-overview layout, in-app “dashboard” labels) — Why parked: prd-v2 §Non-Goals; this milestone is landing page + login-into-the-app only.
- **Voice notes during meeting (FR-012)** — Why parked: deferred from M-1; not in prd-v2 scope.
- **AI summary of past meetings (FR-011)** — Why parked: deferred from M-1; privacy model still open.
- **Reportee login / employee-facing portal** — Why parked: still a product non-goal.
- **Full HR or performance-review suite** — Why parked: still a product non-goal.
- **Real-time co-editing with employees** — Why parked: still a product non-goal.
- **Offline-first / full mobile-native** — Why parked: still a product non-goal.
- **Custom LLM training** — Why parked: still a product non-goal.
- **Calendar, Slack, or Teams integrations** — Why parked: still a product non-goal.

## Milestone History

- **M-1: Core 1-on-1 loop** (`core-1on1-loop`) — closed 2026-08-31. Manager can run a 1-on-1 end to end: create a team and employee, capture notes and tasks live, finalize the meeting, and follow up from a person overview.

## Done

- **S-01: visitor can read what the app is and which problems it solves on the public main page, and can reach existing signup or log in to the app from that page** — Archived 2026-08-31 → `context/archive/2026-08-31-selling-landing-page/`. Lesson: —.
- **S-04: user can open a person overview, select among that employee's meetings, read the selected note, and mark tasks complete or add new tasks from the side panel** — Archived 2026-08-31 → `context/archive/2026-08-15-person-overview-task-followup/`. Lesson: —.
