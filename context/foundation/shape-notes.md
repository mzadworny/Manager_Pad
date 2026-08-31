---
project: Manager Pad
context_type: brownfield
created: 2026-08-30
updated: 2026-08-31
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: change category
      decision: significant feature — replace the Astro starter with a selling landing page + login-into-the-app
    - topic: primary persona scope
      decision: primary new visitor (landing page must sell); secondary existing manager (login into the app)
    - topic: insight / why now
      decision: starter was enough while the app was being built; the product is now real enough to sell
    - topic: must preserve
      decision: login, session, and the existing app (team / people / meetings) must keep working unchanged
    - topic: auth model
      decision: no changes planned — current model preserved
    - topic: roles
      decision: no new roles, no shifting boundaries — one kind of signed-in user
    - topic: mvp flow
      decision: visitor sees selling landing page → sign up or log in → lands in the app
    - topic: blast radius
      decision: public main page + post-login destination / dashboard wording on that path; in-app untouched
    - topic: delivery timeline
      decision: about 1 week of after-hours work
    - topic: domain rule delta
      decision: new rule — the public page must state what the app is and which problems it solves; existing 1:1/people/meetings rule unchanged
    - topic: constraints
      decision: no data migration; respect existing login/signup; don’t break team/people/meetings; public URL still serves the main page
    - topic: product type
      decision: no change — existing web app
    - topic: user base
      decision: same small user base; landing page is for visitors but not opening to a new scale
    - topic: timing
      decision: no hard deadline; after-hours only
    - topic: non-goals
      decision: in-app UX polish (person entry, meeting icon, person-overview layout) is out of this change
  frs_drafted: 7
  quality_check_status: accepted
---

## Seed idea (verbatim)

I would like to add some more changes to the project.

1. When on team dashboard I would like to make entering a person easier - now it's a little arrow that's equal in size to rename and delete. Those other two option should be rarely used compared to the main one.
2. In person view the button to enter a meeting note has an icon that suggest it will be opened in a new window. I don't think it's good.
3. I don't like the UX of the person overview - button for new meeting and opening meeting sit in weird places - I would like to establush a roadmap item for proper research around it.
4. When logging in we land on the main page that's current;y Astro starter rather then in the app. We should land in the app.
5. We should rename "the dashboard" into something that suggest that there is an app there that you can use.
6. Current Astro Starter should be changes into a simple landing page that explains what this app is and how it works and encourages to register/signup.

Additional seed (verbatim, 2026-08-31):

one additional thing to add to the roadmap is the adjustment of the main page which is now astro starter. We need to turn it into a landing page that sells what this app is and allows to log in to the app rather then log in to the dashboard. This page should sell what this app is and what problems its solving.

Scope lock for this shape session: the significant feature only (landing page that sells + login into the app, not “the dashboard”). In-app UX polish and person-overview research from seed items 1–3 are out of this change.

## Current System

Manager Pad already has an app (team, people, meetings) and login. The public main page is still the Astro starter. After login, people land there and are pointed at “the dashboard.”

Tech stack named by the user: the public main page is the Astro starter. Nothing else stated.

Users today: an existing manager who already has an account, plus anyone who hits the public URL.

## Vision & Problem Statement

A visitor (or you, sharing the URL) cannot tell what the product is or which problems it solves. Login does not feel like entering the product — it is framed as logging in to “the dashboard,” and after login you land on the starter page rather than in the app.

The starter was enough while the app was being built; the product is now real enough to sell. This change replaces the Astro starter with a landing page that sells what the app is and what problems it solves, encourages register/signup, and lets people log in to the app rather than to “the dashboard.” After login they should land in the app.

Must preserve: login, session, and the existing app (team / people / meetings) must keep working unchanged.

## User & Persona

**Primary:** a new visitor who does not have an account yet. They hit the public main page and need to understand what this app is, what problems it solves, and be able to register/signup.

### Secondary persona

**Existing manager** (you) who already has an account. After login they must land in the app, not on the starter page, and the entry should feel like logging in to the app rather than to “the dashboard.”

## Access Control

Login already exists; one kind of signed-in user; the public page is unauthenticated.

No changes planned — current model preserved.

## Success Criteria

### Primary

The selling landing page + login-into-the-app flow works:

1. Visitor opens the public URL.
2. They see a landing page that sells what the app is and which problems it solves — not the Astro starter.
3. From that page they can sign up or log in; the language is log in to the app, not “the dashboard.”
4. After login they land in the app, not back on the public page.

Blast radius: public main page + post-login destination / “dashboard” wording on that path. Team / people / meetings stay untouched. Estimated delivery: ~1 week of after-hours work.

### Secondary

The landing page also explains how the app works, not only what problem it solves.

### Guardrails

Login, session, and team/people/meetings keep working unchanged.

## Functional Requirements

### Landing page

- FR-001: Visitor can read what the app is and which problems it solves on the public main page. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "This turns into a copy-writing trap and delays the real product work." Resolution: kept as must-have; a clear honest page is enough — don’t block on polished marketing copy.
- FR-002: Visitor can read how the app works on that page. Priority: nice-to-have. Change: new
  > Socrates: Counter-argument considered: "It duplicates FR-001 — problem + product is enough; mechanism belongs later." Resolution: kept as nice-to-have; “how it works” can be a short paragraph, not a second page.

### Sign-up and login path

- FR-003: Visitor can reach register/sign up from the landing page (existing signup, not a new registration campaign). Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "You’re not ready for open registration — encouraging signup on a public page is premature." Resolution: kept; landing page links to existing signup — not a new open-registration campaign.
- FR-004: Visitor / manager can log in to the app (not “the dashboard”) from the landing page. Priority: must-have. Change: modified
  > Socrates: No counter-argument; it stands as written.
- FR-005: Signed-in user lands in the app after login, not on the public page. Priority: must-have. Change: modified
  > Socrates: No counter-argument; it stands as written.

### Preserved

- FR-006: Signed-in user can still authenticate and keep a session. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; it stands as written.
- FR-007: Manager can still use team, people, and meetings unchanged. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; it stands as written.

## User Stories

### US-01: Visitor is sold, then enters the app

- **Given** a visitor on the public URL (Astro starter today)
- **When** they open the main page
- **Then** they see a page that sells what the app is and which problems it solves, can sign up or log in to the app (not “the dashboard”), and after login land in the app — not back on the public page.

## Business Logic

The public page must state what the app is and which problems it solves.

The existing rule is unchanged: the app is a place for a manager to keep 1:1 / people / meeting notes. This change does not rewrite that.

A visitor hits the public URL, reads what the app is and which problems it solves (honest copy, not a polished marketing campaign), and can reach existing signup or log in to the app.

## Constraints & Preserved Behavior

No data migration. Respect existing login/signup. Don’t break team / people / meetings. The public URL still serves the main page (now a landing page instead of the Astro starter).

## Non-Functional Requirements

- A visitor can tell what the product is from the public page without needing polished marketing.

## Non-Goals

- In-app UX polish (person entry on the team list, meeting-note icon, person-overview layout) is out of this change — this session is the landing page + login-into-the-app only.

## Quality cross-check

All brownfield checks present (Access Control, Business Logic one-sentence rule, project artifacts, timeline-cost, Non-Goals, preserved behavior). No gaps. Status: accepted.
