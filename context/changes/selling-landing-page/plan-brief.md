# Selling Landing Page — Plan Brief

> Full plan: `context/changes/selling-landing-page/plan.md`

## What & Why

A visitor (or anyone sharing the URL) cannot tell what Manager Pad is: public `/` is still the 10x Astro starter. This change replaces that page with an honest sell: what the app is, which problems it solves, and links to existing signup and log in. Polished marketing is not required.

## Starting Point

`index.astro` renders `Welcome.astro` (starter hero + stack feature cards) and already links to `/auth/signin` and `/auth/signup`. Layout default title is still “10x Astro Starter.” Sign-in redirects to `/`; signed-in Topbar says Dashboard. That redirect is S-02, not this slice.

## Desired End State

Guests on `/` read Manager Pad, a one-paragraph product statement, and three problem cards, then Sign up (primary) or Log in (secondary) on the existing auth pages. Signed-in visitors see **Open the app** instead of Dashboard. After login they still land on `/` until `login-lands-in-app`.

## Key Decisions Made

| Decision       | Choice                                 | Why (1 sentence)                                                   | Source        |
| -------------- | -------------------------------------- | ------------------------------------------------------------------ | ------------- |
| Slice boundary | Landing only; leave `signin.ts` → `/`  | Roadmap split so the sell page can ship without destination polish | Roadmap       |
| How it works   | Out                                    | Parked nice-to-have under speed / time                             | Roadmap / PRD |
| Copy           | Draft from PRD, locked in the plan     | Honest page; don’t block on a marketing rewrite                    | Plan          |
| Visual         | Keep cosmic glass; swap copy/cards     | Matches auth; fastest honest page                                  | Plan          |
| CTAs           | Sign up primary, Log in secondary      | Primary persona is a new visitor                                   | Plan          |
| Structure      | Hero + 3 problem cards                 | Must-have is what it is / problems it solves                       | Plan          |
| Signed-in `/`  | Topbar **Open the app** → `/dashboard` | Public-path language without stealing S-02 redirect                | Plan          |
| Implementation | Static Astro, no new island / tests    | Stack assessment + AGENTS.md Testing                               | Research      |

## Scope

**In scope:**

- Replace starter Welcome with product landing (copy, CTAs, problem cards)
- Page title Manager Pad; Topbar “Open the app”
- S-01-scoped public-page rules in `AGENTS.md`

**Out of scope:**

- Post-login redirect and signed-in bounce from `/` (S-02)
- How-it-works, marketing extras, in-app dashboard labels
- Schema, new auth, test runner

## Architecture / Approach

Keep `/` as unauthenticated SSR Astro. Rename `Welcome.astro` → `Landing.astro`, reuse Topbar and cosmic styles, link to existing `/auth/*`. Two phases: guest sell page first, then signed-in chrome + agent rules.

## Phases at a Glance

| Phase                             | What it delivers                                | Key risk                                       |
| --------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| 1. Selling landing content        | Product hero + problem cards + Sign up / Log in | Copy-writing rabbit hole (copy is locked)      |
| 2. Signed-in chrome + conventions | Open the app; Manager Pad title; AGENTS.md      | Stealing S-02 by “fixing” the sign-in redirect |

**Prerequisites:** Auth pages and `/dashboard` already exist (M-1). No schema.
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- Until S-02, signing in still returns to the public page — expected, not a bug
- Locked copy is English-only, honest, not campaign-grade
- Linear MCP was unauthenticated during planning; `linear_issue` left unset (sync skipped)

## Success Criteria (Summary)

- A guest can tell what Manager Pad is and which problems it solves from `/`
- Sign up and Log in reach the existing auth pages (Sign up visually primary)
- Signed-in Topbar says Open the app, not Dashboard; team/people/meetings stay intact
