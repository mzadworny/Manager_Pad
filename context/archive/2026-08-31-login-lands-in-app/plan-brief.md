# Login Lands in the App — Plan Brief

> Full plan: `context/changes/login-lands-in-app/plan.md`

## What & Why

After login, the manager still lands on the public selling page. The product promise (prd-v2 FR-005) is to enter the app, not `/`. This change retargets successful sign-in to `/dashboard` and writes that rule into `AGENTS.md`.

## Starting Point

S-01 shipped the landing and Topbar **Open the app**. `/dashboard` already is the teams/people hub. `signin.ts` still `redirect("/")`. Middleware does not bounce signed-in users off `/`. In-app “Dashboard” labels are parked polish.

## Desired End State

Sign in → `/dashboard` with session and TeamList. Guests still see `/`. A signed-in later visit to `/` still shows the landing. Sign-out still returns to `/`. Failed sign-in still stays on `/auth/signin`.

## Key Decisions Made

| Decision      | Choice                          | Why (1 sentence)                                                                 |
| ------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| Destination   | Always `/dashboard`             | That URL is already the app home; no new route or `redirectTo`                   |
| Signed-in `/` | Keep landing + **Open the app** | Login redirect satisfies FR-005; bouncing `/` would hide the sell from the owner |
| Auth copy     | Redirect only                   | Public-path “Dashboard” is already gone; in-app labels stay parked               |
| Auth while in | Leave `/auth/signin` as-is      | Extra middleware branch is out of blast radius                                   |
| Instructions  | `AGENTS.md` only                | Agents read that file; health-check / stack-assessment stay historical           |

## Scope

**In scope:**

- `signin.ts` success redirect → `/dashboard` (plus `prerender = false` on that file)
- Live post-login bullets in `AGENTS.md`

**Out of scope:**

- Signed-in bounce from `/` or `/auth/*`
- Return-to-origin / `redirectTo`
- Sign-out, signup, confirm-email, auth copy, in-app Dashboard labels
- Protecting `/`, renaming `/dashboard`, test runner

## Architecture / Approach

Classic form POST to `/api/auth/signin`; change the success 302 Location from `/` to `/dashboard`. Leave middleware and `/` public. Phase 2 replaces the S-01 deferral in `AGENTS.md` with the live destination rule.

## Phases at a Glance

| Phase                             | What it delivers                          | Key risk                                         |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| 1. Post-login lands on /dashboard | Sign-in 302 → `/dashboard`                | “Helpful” signed-in bounce from `/`              |
| 2. Agent conventions              | `AGENTS.md` owns the live post-login rule | Pasting the whole stack-assessment block (dupes) |

**Prerequisites:** S-01 done; `/dashboard` and cookie auth already exist. No schema.
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- Browser verification is the only product check (no test runner)
- First login after confirm-email uses the same `signin.ts` path, so it inherits `/dashboard` automatically
- Linear MCP was unauthenticated during planning; `linear_issue` left unset (sync skipped)

## Success Criteria (Summary)

- Sign in from the landing lands on `/dashboard` with teams/people
- Signed-in `/` is still the selling page; sign-out still returns there
- Agents are instructed to keep that destination and not bounce `/`
