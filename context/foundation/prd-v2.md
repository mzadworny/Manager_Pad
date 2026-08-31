---
project: Manager Pad
version: 2
status: draft
created: 2026-08-31
context_type: brownfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

Manager Pad already has an app (team, people, meetings) and login. The app is a place for a manager to keep 1:1 / people / meeting notes.

The public main page is still the Astro starter. After login, people land there and are pointed at “the dashboard.”

Tech stack named by the user: the public main page is the Astro starter. Nothing else stated.

# TODO: key architecture — see Open Questions

Users today: an existing manager who already has an account, plus anyone who hits the public URL. Same small user base; the landing page is for visitors but not opening to a new scale.

## Problem Statement & Motivation

A visitor (or you, sharing the URL) cannot tell what the product is or which problems it solves. Login does not feel like entering the product — it is framed as logging in to “the dashboard,” and after login you land on the starter page rather than in the app.

The starter was enough while the app was being built; the product is now real enough to sell. This change replaces the starter page with a landing page that sells what the app is and what problems it solves, lets people reach existing signup or log in to the app rather than to “the dashboard,” and after login they should land in the app.

## User & Persona

**Primary:** a new visitor who does not have an account yet. They hit the public main page and need to understand what this app is, what problems it solves, and be able to register/signup.

### Secondary persona

**Existing manager** (you) who already has an account. After login they must land in the app, not on the starter page, and the entry should feel like logging in to the app rather than to “the dashboard.”

## Success Criteria

### Primary

The selling landing page + login-into-the-app flow works:

1. Visitor opens the public URL.
2. They see a landing page that sells what the app is and which problems it solves — not the starter page.
3. From that page they can sign up or log in; the language is log in to the app, not “the dashboard.”
4. After login they land in the app, not back on the public page.

Blast radius: public main page + post-login destination / “dashboard” wording on that path. Team / people / meetings stay untouched. Estimated delivery: ~1 week of after-hours work.

### Secondary

The landing page also explains how the app works, not only what problem it solves.

### Guardrails

Login, session, and team/people/meetings keep working unchanged.

A visitor can tell what the product is from the public page without needing polished marketing.

## User Stories

### US-01: Visitor is sold, then enters the app

- **Given** a visitor on the public URL (the public main page is the starter page today)
- **When** they open the main page
- **Then** they see a page that sells what the app is and which problems it solves, can sign up or log in to the app (not “the dashboard”), and after login land in the app — not back on the public page.

Before: after login, people land on the public main page and are pointed at “the dashboard.”

## Scope of Change

- [new] Visitor can read what the app is and which problems it solves on the public main page. Priority: must-have
  > Socrates: Counter-argument considered: "This turns into a copy-writing trap and delays the real product work." Resolution: kept as must-have; a clear honest page is enough — don’t block on polished marketing copy.
- [new] Visitor can read how the app works on that page. Priority: nice-to-have
  > Socrates: Counter-argument considered: "It duplicates FR-001 — problem + product is enough; mechanism belongs later." Resolution: kept as nice-to-have; “how it works” can be a short paragraph, not a second page.
- [modified] Visitor can reach register/sign up from the landing page (existing signup, not a new registration campaign). Was: signup exists on its own path. Now: landing page links to existing signup. Priority: must-have
  > Socrates: Counter-argument considered: "You’re not ready for open registration — encouraging signup on a public page is premature." Resolution: kept; landing page links to existing signup — not a new open-registration campaign.
- [modified] Visitor / manager can log in to the app (not “the dashboard”) from the landing page. Was: login framed as logging in to “the dashboard.” Now: log in to the app. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [modified] Signed-in user lands in the app after login, not on the public page. Was: after login, people land on the public main page. Now: they land in the app. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [preserved] Signed-in user can still authenticate and keep a session. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [preserved] Manager can still use team, people, and meetings unchanged. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## Constraints & Compatibility

No data migration. Respect existing login/signup. Don’t break team / people / meetings. The public URL still serves the main page (now a landing page instead of the starter page).

Must preserve: login, session, and the existing app (team / people / meetings) must keep working unchanged.

No extra deployment / CI / API / monitoring constraints beyond what’s already captured.

## Business Logic Changes

The public page must state what the app is and which problems it solves.

The existing rule is unchanged: the app is a place for a manager to keep 1:1 / people / meeting notes. This change does not rewrite that.

A visitor hits the public URL, reads what the app is and which problems it solves (honest copy, not a polished marketing campaign), and can reach existing signup or log in to the app.

## Access Control Changes

No access control changes — current model preserved.

Login already exists; one kind of signed-in user; the public page is unauthenticated.

## Non-Goals

- In-app UX polish (person entry on the team list, meeting-note icon, person-overview layout) is out of this change — this session is the landing page + login-into-the-app only.

## Open Questions

1. **What is the key architecture of the current system?** — Not captured in shape-notes (the schema asks for how the system is structured). Owner: user. Does not block this change; core functionality (team, people, meetings, login) is captured. Downstream stack assessment can fill this from the existing system.
