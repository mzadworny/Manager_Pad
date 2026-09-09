# Guest by-id isolation proofs — Plan Brief

> Full plan: `context/changes/isolation-guest-by-id/plan.md`
> Research: `context/archive/2026-08-31-testing-isolation-runner-bootstrap/research.md`

## What & Why

A guest / unauthenticated request can read any manager’s data (page or API). Collection GET/POST is already proven; by-id handlers are separate files, so dropping `requireApiAuth` on `/api/meetings/[id]` would not fail today’s suite. This change occupies that hole with HTTP proofs. It does not add new authz.

## Starting Point

Vitest, `guestFetch` / `expectGuestUnauthorized`, and cookbook §6.2 already exist. `requireApiAuth` is the guest gate; middleware does not cover `/api`. Research left guest by-id as an open question: missing auth yields 404, not 401.

## Desired End State

`npm test` fails if a guest can GET/PATCH/DELETE a by-id product row or list tasks by `meetingId`, or if `GET /meetings` no longer redirects to sign-in. Cookbook §6.2 tells the next author that guest by-id is **401 not 404**. CI still does not run tests.

## Key Decisions Made

| Decision      | Choice                                   | Why (1 sentence)                                                            | Source |
| ------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ------ |
| Coverage      | All 10 by-id methods + `?meetingId=`     | Each by-id file is its own `requireApiAuth` call; collection tests miss it  | Plan   |
| IDs           | Synthetic `WELL_FORMED_UUID`             | Auth returns before lookup; real rows would need fixtures for no extra leak | Plan   |
| Pages         | Add `GET /meetings` to the redirect loop | Cookbook already names three prefixes; HTTP only hit two                    | Plan   |
| Cookbook      | §6.2 / §6.6 401 ≠ 404 note               | Same follow-on shape as risk #1 writes                                      | Plan   |
| Change folder | New `isolation-guest-by-id`              | Parent change is archived; do not overwrite its plan                        | Plan   |

## Scope

**In scope:**

- Guest by-id GET/PATCH/DELETE on employees, meetings, tasks, teams (methods that exist)
- Guest `GET /api/tasks?meetingId=`
- Guest `GET /meetings` redirect
- Cookbook §6.2 / §6.6 note

**Out of scope:**

- Real UUIDs / fixtures, Playwright, pgTAP, CI, new RLS, remaining risk #1 writes, capture/overview tests

## Architecture / Approach

Same guest harness: `fetch` `TEST_BASE_URL` with no `Cookie`, `Origin` set, `redirect: "manual"`. Oracles are 401 + `{ error: "Unauthorized" }` + empty `populatedProductKeys`. PATCH bodies are schema-valid so dropped-auth cannot hide behind 400.

## Phases at a Glance

| Phase                             | What it delivers                    | Key risk                                  |
| --------------------------------- | ----------------------------------- | ----------------------------------------- |
| 1. Guest by-id + /meetings proofs | 11 API cases + `/meetings` redirect | Treating 404 as deny; invalid PATCH → 400 |
| 2. Cookbook by-id guest note      | §6.2 names 401 not 404              | Cookbook that copies handler 404 strings  |

**Prerequisites:** Existing isolation harness (`globalSetup` or `TEST_BASE_URL`). Guest cases do not need the two manager accounts; the rest of `npm test` does.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Anon still has no SELECT policy. A synthetic 401 proof does not catch a future public SELECT on a **real** id; that would need fixtures and is out of scope.
- Isolation tests still share the cloud project with manual use; this change writes no rows.

## Success Criteria (Summary)

- A guest cannot read or write through by-id product APIs
- Guest `/meetings` redirects to sign-in
- A later author can copy “401 not 404” from §6.2 without re-reading research
