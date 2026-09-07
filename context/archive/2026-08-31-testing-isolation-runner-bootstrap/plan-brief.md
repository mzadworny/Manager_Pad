# Isolation + runner bootstrap — Plan Brief

> Full plan: `context/changes/testing-isolation-runner-bootstrap/plan.md`
> Frame brief: `context/changes/testing-isolation-runner-bootstrap/frame.md`

## What & Why

> **The actual problem to plan around is**: there is no test runner, so existing isolation gates have no durable automated proof — and this change is the product decision that both creates the home and occupies it with proofs of risks #1 and #2.

Guest deny already lives in `requireApiAuth`; cross-manager deny already lives in RLS. Tests lock that behavior.

## Starting Point

No Vitest, no `test` script, no test files. One documented manager. Middleware gates pages only; all eight product APIs call `requireApiAuth`; invisible rows are 404 (or 200-empty lists), never 403. CI is lint+build. Isolation was once checked by hand for teams/employees and never made a suite.

## Desired End State

`npm test` runs a unit file without a server, and integration files that sign in two cloud managers against live `astro dev`. Guest APIs 401 with empty bodies; guest protected pages 302 to sign-in. Manager B cannot read or write A’s people/meetings/notes/tasks. Cookbook §6.1–6.3 exists. CI still does not run tests.

## Key Decisions Made

| Decision       | Choice                                        | Why (1 sentence)                                                                       | Source |
| -------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| Scope          | Runner + isolation #1 and #2 in one change    | Frame: do not split; CI/Playwright/Docker stay later                                   | Frame  |
| Nature of work | Proofs of existing gates, not new authz       | `requireApiAuth` + RLS already enforce; tests must not copy handler code as oracle     | Frame  |
| Manager B      | Create + document in this change              | Only one account exists; #1 needs two cookie sessions                                  | Plan   |
| Matrix         | Representative + 200-empty vs 404 quirks      | Cost × signal; those list endpoints are the “logged in ≠ owns row” trap                | Plan   |
| Live server    | `globalSetup` starts `astro dev`, reuse if up | HTTP + real cookies; preview/build is extra cost                                       | Plan   |
| Guest pages    | HTTP 302, not Playwright                      | Phase 1 test types are unit + API integration                                          | Plan   |
| Fixtures       | Unique names; A soft-deletes in `afterAll`    | Shared cloud project must not accumulate `iso-*` people                                | Plan   |
| Vitest config  | `vitest/config` `defineConfig`, Vitest 4.x    | Vite 7 override; tests do not import Astro components (`getViteConfig` crash deferred) | Plan   |

## Scope

**In scope:**

- Vitest 4, `npm test`, unit occupant (page vs `/api` gate)
- Two documented managers, cookie harness, `astro dev` globalSetup
- Guest #2 and cross-manager #1 isolation tests + cleanup
- test-plan §6.1–6.3 and AGENTS testing stamp

**Out of scope:**

- CI test gate, Playwright, pgTAP/Docker, new authz
- Capture/overview persist tests, landing copy, happy-path CRUD suites

## Architecture / Approach

Vitest runs unit tests in-process (shared `PROTECTED_ROUTES` module). Integration tests `fetch` `TEST_BASE_URL` with cookie jars from form POST `/api/auth/signin`. Oracles come from the test-plan (401 empty; B never receives A’s payloads; 404 vs 200-empty), not from handler implementations.

## Phases at a Glance

| Phase                  | What it delivers                                  | Key risk                                                |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| 1. Runner home         | `npm test` runs a unit file; AGENTS forbid lifted | Pulling `astro:env` into units / `getViteConfig` crash  |
| 2. Two-session harness | Live server + A/B cookies + documented B          | Email confirm / missing env looks like an isolation bug |
| 3. Isolation proofs    | Guest + representative A/B matrix + cleanup       | Expecting 403; leftover cloud fixtures                  |
| 4. Cookbook            | §6.1–6.3 + AGENTS pointer                         | Cookbook that restates handler code as the oracle       |

**Prerequisites:** Cloud `SUPABASE_*` in `.env` / `.dev.vars`; ability to create a second auth user on that project.
**Estimated effort:** ~2–3 sessions across 4 phases (Phase 2 blocked on creating Manager B).

## Open Risks & Assumptions

- Frame confidence was **MEDIUM**: Manager B did not exist at planning time — creating it is in-scope and may need a manual email-confirm in Supabase
- Isolation tests write (then delete) rows on the **cloud** project used for manual work
- `astro:middleware` `redirect()` is assumed to be 302/303 with `Location` `/auth/signin`

## Success Criteria (Summary)

- `npm test` is a real command that runs files
- A guest cannot read product JSON or open `/dashboard`
- A signed-in Manager B cannot read or write Manager A’s people, meetings, notes, or tasks
