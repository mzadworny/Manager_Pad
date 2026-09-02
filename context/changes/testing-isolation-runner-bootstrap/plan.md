# Isolation + runner bootstrap Implementation Plan

## Overview

This change is the product decision that adds Vitest and occupies it with durable proofs of manager-to-manager isolation (risk #1) and guest isolation (risk #2). Tests lock existing gates (`requireApiAuth` + RLS); they do not add new authz. CI still does not run the suite (rollout Phase 3).

## Current State Analysis

There is no test runner, no `test` script, and no `*.test.*` files. `AGENTS.md` forbids inventing a framework until a product decision — this change is that decision. CI is lint + build only.

Isolation already exists in production code:

- All eight product APIs call `requireApiAuth` (`src/lib/api-auth.ts`). Unauthenticated → **401** `{ error: "Unauthorized" }`.
- `PROTECTED_ROUTES` in middleware covers `/dashboard`, `/employees`, `/meetings` only — **not** `/api`. Guest page deny is a **302** to `/auth/signin`.
- Row visibility is RLS `auth.uid() = manager_id`. Handlers collapse invisible rows with `maybeSingle` → **404**, not 403. 403 is reserved for system-team rename/delete.
- Two list endpoints do **not** 404 on a foreign `employeeId`: `GET /api/meetings?employeeId=` and `GET /api/tasks?employeeId=` return **200** with an empty array. `GET /api/tasks?meetingId=` and `GET /api/employees?teamId=` **do** 404 when the parent is invisible.

A one-shot manual isolation check for teams/employees was ticked in archive `create-team-and-employee` (plan step 9 / Progress 3.8) and never became a suite. One manager is documented in `context/foundation/test-accounts.md`. Cookie sessions come from form POST `/api/auth/signin` (`email`/`password`); names are whatever `@supabase/ssr` sets.

Default Supabase target is **cloud**. Phase 1 must not depend on `supabase start`, Playwright, or pgTAP.

## Desired End State

`npm test` runs Vitest. A unit file proves the page-vs-API gate without a live server. Integration files hit a live `astro dev` (or `TEST_BASE_URL`) with real cookies:

- Guest product APIs are 401 and empty of notes/tasks/people; guest `/dashboard` and one other protected page 302 to `/auth/signin`.
- Manager B cannot read or write Manager A’s people, meetings, notes, or tasks (404 or 200-empty per the matrix below); A’s rows are unchanged after B’s attempts.

Two cloud managers are documented. Cookbook §6.1–6.3 tells later phases how to add tests. CI is still lint+build only.

### Key Discoveries:

- Isolation oracles live in `context/foundation/test-plan.md` §2, not in handler `if`s — there are no ownership branches to copy (`src/lib/api-auth.ts:20-21`; RLS in the two product migrations)
- Cross-manager is **never 403**; 403 means system team (`src/pages/api/teams/[id].ts:62-63`, `:118-119`)
- List-by-foreign-employee is **200 empty** for meetings and tasks (`src/pages/api/meetings.ts:36-47`, `src/pages/api/tasks.ts:74-97`); list-by-foreign-meeting or team is **404**
- Sign-in is form POST + 302 `/dashboard` with `Set-Cookie`; there is no Bearer path (`src/pages/api/auth/signin.ts:6-21`, `src/lib/supabase.ts:9-22`)
- `astro:env/server` will not resolve inside Vitest unit imports of `src/lib/supabase.ts` — isolation tests stay HTTP-against-live-server
- Repo already forces Vite 7.3.x (`package.json` overrides) — pin **Vitest 4.x** (≥4.1). Isolation tests do not import Astro components, so use `defineConfig` from `vitest/config`, **not** `getViteConfig` (avoids the unfiltered-config crash in test-plan §4)
- Typed ESLint + `react-compiler` applies to all `*.ts` (`eslint.config.js:14-20`, `:41-59`); `tests/` needs an override. `coverage/` is not gitignored yet
- `tsconfig.json` `include: **/*` will pick up tests; `@/*` → `./src/*` works from `tests/`

## What We're NOT Doing

- Playwright, e2e, or browser smoke beyond HTTP status/Location on pages
- pgTAP, Docker, or `supabase start` as a Phase 1 dependency
- Wiring `npm test` into CI or husky (rollout Phase 3)
- New authz, new RLS, or handler ownership `if`s — tests prove existing gates
- Happy-path CRUD suites, capture/overview persist tests (rollout Phase 2), or landing-page copy assertions (§7)
- Mocking `requireApiAuth`, Supabase, or RLS in isolation tests
- `getViteConfig` / Astro Container API (not needed for HTTP tests)
- Service-role keys, Bearer-header auth, or a second registration system
- Editing `health-check.md` / `stack-assessment.md` (historical snapshots)

## Implementation Approach

Four phases, cheapest signal first:

1. Vitest home + a unit occupant that does not need cloud or a server, and lift the `AGENTS.md` “do not invent a runner” forbid.
2. Live-server harness: `globalSetup` starts or reuses `astro dev`; cookie sessions for two documented managers; auth smoke.
3. Isolation proofs with oracles from the test-plan: guest #2, then cross-manager #1, unique fixtures, `afterAll` cleanup.
4. Write cookbook §6.1–6.3 and pin Vitest in test-plan §4 so later rollout phases have a pattern.

## Critical Implementation Details

**Sign-in cookie capture.** `POST /api/auth/signin` is `multipart/form-data` or `application/x-www-form-urlencoded` with `email` and `password`, then **302**. Use `redirect: "manual"` (or equivalent) so `Set-Cookie` is not dropped by an automatic follow. Replay the full cookie jar on later requests. Do not hardcode `sb-*-auth-token` names.

**Do not expect 403 for “not your row.”** Invisible resources are 404 or 200-empty. A test that expects 403 for Manager B will fail while isolation is working.

**Cleanup uses A’s session.** Unique names per run (`iso-<runId>-…`). Manager A soft-deletes the fixture employee (RPC cascades meetings/tasks) then the unique team. Never delete the All people system team. If B’s writes were incorrectly allowed, A’s re-read assertions fail before cleanup.

**`npm test` in Phase 1 must not require a server.** Add `globalSetup` in Phase 2. Unit files stay runnable with `vitest run tests/unit`.

---

## Phase 1: Runner home

### Overview

Vitest 4 is installed and `npm test` runs a unit file with no live app and no test accounts. Middleware’s page-vs-API gate is a shared constant so the unit oracle is not a copied list in the test file. `AGENTS.md` records that a runner exists and that CI still does not run it.

### Changes Required:

#### 1. Vitest + scripts + ignores

**File**: `package.json`, `vitest.config.ts`, `.gitignore`

**Intent**: Add the runner the rest of the rollout will use, compatible with the existing Vite 7 override.

**Contract**: Dev dependency Vitest **4.x** (≥4.1). Scripts: `test` → `vitest run`, optional `test:watch` → `vitest`. Config uses `defineConfig` from `vitest/config` (not `astro/config` `getViteConfig`), `globals` off (explicit `vitest` imports), include `tests/**/*.test.ts`. Gitignore `coverage/` and Vitest cache dirs if the chosen version creates them.

#### 2. Page-vs-API gate as a shared module

**File**: `src/lib/protected-routes.ts`, `src/middleware.ts`

**Intent**: Make the middleware prefix list importable so a unit test can assert `/api` is ungated without importing middleware (and thus `astro:env/server`).

**Contract**: `PROTECTED_ROUTES` remains `/dashboard`, `/employees`, `/meetings`. Middleware uses the shared helper/`startsWith` behavior unchanged. Guest `/` and `/api/*` stay ungated.

#### 3. Unit occupant

**File**: `tests/unit/protected-routes.test.ts`

**Intent**: Prove the runner can execute a file, and lock the risk #2 assumption that page middleware does not cover APIs.

**Contract**: `isProtectedPath` (or equivalent) is true for `/dashboard`, `/employees/<id>`, `/meetings/<id>`; false for `/`, `/auth/signin`, `/api/teams`, `/api/employees`, `/api/meetings`, `/api/tasks`. Do not snapshot HTML. Do not import `src/lib/supabase.ts`.

#### 4. ESLint for tests

**File**: `eslint.config.js`

**Intent**: Typed lint still runs on tests; React-compiler rules do not.

**Contract**: Override `tests/**/*.{ts,tsx}` to turn off `react-compiler/react-compiler` (and React `react-in-jsx-scope` remains off). Tests stay in the TypeScript project.

#### 5. Agent testing rule

**File**: `AGENTS.md`

**Intent**: This change is the product decision; the old forbid would block the rest of the rollout.

**Contract**: Replace the “No test runner / Do not invent a framework” paragraph with: Vitest via `npm test`; do not add a second framework; CI does not run tests yet (test-plan §3 Phase 3). Do not yet point at cookbook §6 (that lands in Phase 4). Do not edit `CLAUDE.md` unless a Testing heading already exists (it does not).

### Success Criteria:

#### Automated Verification:

- `npm test` (or `npx vitest run tests/unit`) passes with no `TEST_BASE_URL`, no manager env, and no listening app
- `npm run lint` passes including `tests/` and `src/lib/protected-routes.ts`
- `npm run build` still succeeds with existing `SUPABASE_*` env

#### Manual Verification:

- Terminal output from `npm test` shows the unit file ran and passed — the visible “runner home” done-state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Two-session harness

### Overview

Integration tests can obtain Manager A and Manager B cookie jars against a live `astro dev` (reused if already up). Manager B is created on the cloud project and documented. A failing env setup prints where to look, not a bare 401.

### Changes Required:

#### 1. Manager B + env contract

**File**: `context/foundation/test-accounts.md`, `.env.example`

**Intent**: Risk #1 is not implementable with one documented account. Keep credentials out of test source.

**Contract**: Document Manager A (existing) and Manager B (created on the same cloud project the app’s `.dev.vars` points at): email, password, purpose, email-confirm note. `.env.example` lists `TEST_BASE_URL`, `TEST_MANAGER_A_EMAIL`, `TEST_MANAGER_A_PASSWORD`, `TEST_MANAGER_B_EMAIL`, `TEST_MANAGER_B_PASSWORD` as placeholders — never real secrets. Tests read `process.env` (and may load `.env` if Vitest is configured to). Missing vars **fail** `beforeAll` with a message pointing at `test-accounts.md` and `.env.example`; do not `skip` the suite. Do not commit `.env` / `.dev.vars`.

#### 2. globalSetup for astro dev

**File**: `tests/global-setup.ts`, `vitest.config.ts`

**Intent**: `npm test` can boot the app the isolation tests HTTP against, without a second manual terminal, and without fighting an already-running dev server.

**Contract**: If `TEST_BASE_URL` (default `http://localhost:4321`) already responds, reuse it and do not spawn. Otherwise spawn `npm run dev`, wait until the URL responds (timeout on the order of 60–120s; workerd is slow to bind), return a teardown that kills only the process this setup started. Do not `astro build` + preview. Do not `supabase start`.

#### 3. Cookie session helper

**File**: `tests/helpers/session.ts`

**Intent**: Two independent cookie jars, the same way a browser signs in.

**Contract**: `signIn(email, password)` POSTs to `/api/auth/signin` with form fields `email` / `password`, captures `Set-Cookie` under `redirect: "manual"`, returns a `fetch` wrapper (or cookie header) that sends those cookies. A and B must not share a jar. No Authorization bearer. Auth APIs (`/api/auth/*`) are not product isolation targets.

#### 4. Auth smoke

**File**: `tests/integration/harness-smoke.test.ts` (or equivalent)

**Intent**: Prove both sessions are authenticated before isolation assertions can be blamed on a bad cookie.

**Contract**: With A’s cookies, `GET /api/teams` is 200 and JSON has a `teams` array. Same for B. Do not assert team contents here (B must not see A’s teams — that is Phase 3).

### Success Criteria:

#### Automated Verification:

- `npm test` starts or reuses `astro dev` and the harness smoke passes when `.env` has both managers
- Missing `TEST_MANAGER_B_*` fails with an actionable message (not an uncaught 401)
- `npm run lint` still passes

#### Manual Verification:

- Manager B can log in at `/auth/signin` on the local app against cloud Supabase (email confirmed)
- Both accounts are listed in `test-accounts.md` with purpose “isolation tests / Phase 1”

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Isolation proofs

### Overview

First occupants of the suite: guest deny (#2) and cross-manager deny (#1), with oracles from the test-plan risk responses. Unique fixtures per run; A cleans them up.

### Changes Required:

#### 1. Guest isolation (#2)

**File**: `tests/integration/guest-isolation.test.ts`

**Intent**: Unauthenticated product APIs are gated even though middleware never sees `/api`; protected pages still redirect. Challenge “middleware on pages implies APIs are gated” and “status-only while JSON still leaks.”

**Contract**: No `Cookie` header. For each resource family (teams, employees, meetings, tasks) send at least one GET and one mutating method (POST or PATCH) to a product path. Expect **401** and JSON `{ error: "Unauthorized" }` (or equivalent) **and** parsed body must not contain populated `teams` / `employees` / `meetings` / `tasks` / `notesJson` / `notes` payloads. Meetings/tasks GETs may include a well-formed UUID query param so the handler would have returned data if the gate were missing.

Pages: `GET /dashboard` and `GET /employees` (or `/meetings`) with `redirect: "manual"` → **302** (or 303) whose `Location` is `/auth/signin` (path match, ignore origin). Negative control: `GET /` is **200** and is **not** a redirect to sign-in — no landing copy assertions (§7).

Do not use Playwright. Do not treat auth routes as product APIs.

#### 2. Fixture helper

**File**: `tests/helpers/fixtures.ts`

**Intent**: A owns a unique team, employee, meeting, and task so B can attack real ids; leftover cloud rows do not accumulate.

**Contract**: Names include a per-run token (`iso-<unique>-…`). Create via product APIs as A (POST team → employee → meeting → task with a distinctive title/topics). `afterAll` (or equivalent) as A: soft-delete the employee (cascades meetings/tasks) then the unique team. Best-effort cleanup if a test fails mid-run. Never target the All people system team.

#### 3. Cross-manager isolation (#1)

**File**: `tests/integration/cross-manager-isolation.test.ts`

**Intent**: Logged-in ≠ owns this row; UI hide ≠ API deny. Manager B’s requests never return A’s notes/tasks/people on read **or** write; A’s rows still look the same afterward.

**Contract**: Representative matrix (not every method on every route). After A creates fixtures, as **B**:

| B’s request                                  | Expect                     | Must also                        |
| -------------------------------------------- | -------------------------- | -------------------------------- |
| `GET /api/employees/:id` (A’s employee)      | 404                        | no `employee` object             |
| `PATCH /api/employees/:id` (rename)          | 404                        |                                  |
| `GET /api/meetings/:id` (A’s meeting)        | 404                        | no `notesJson` / meeting payload |
| `PATCH /api/meetings/:id` (topics or notes)  | 404                        |                                  |
| `GET /api/meetings?employeeId=` A’s employee | **200** `{ meetings: [] }` | not 404                          |
| `GET /api/tasks?employeeId=` A’s employee    | **200** `{ tasks: [] }`    | not 404                          |
| `GET /api/tasks?meetingId=` A’s meeting      | **404**                    |                                  |
| `POST /api/tasks` with A’s `meetingId`       | 404                        |                                  |
| `GET /api/teams`                             | 200                        | A’s team `id` absent             |
| `GET /api/employees?teamId=` A’s team        | 404                        |                                  |
| `GET /api/employees` (no filter)             | 200                        | A’s employee `id` absent         |
| `DELETE /api/tasks/:id` (A’s task)           | 404                        |                                  |

Then as **A**: GET employee, meeting, and task still succeed; meeting topics/notes and task title unchanged from what A wrote.

Do not expect 403. Do not assert by reading handler source as the expected body. Do not add a second manager’s data as a “see both lists” happy path.

### Success Criteria:

#### Automated Verification:

- Guest isolation file passes (401 + empty payloads; page 302; `/` not redirected)
- Cross-manager file passes the matrix above plus A’s unchanged re-read
- After a green run, A no longer GET-200s the unique fixture employee/team (cleanup)
- Full `npm test` passes (unit + harness smoke + isolation)

#### Manual Verification:

- A’s dashboard after the suite does not show leftover `iso-*` people/teams from this run
- Spot-check one failing assertion mentally: if B GET meeting returned 200 with notes, the test would fail (oracle is “no A payload,” not “status is 404 because the handler says so”)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Cookbook

### Overview

Later rollout phases and new endpoints should copy a pattern, not rediscover this change. Update test-plan §6.1–6.3 and the stack pin; point `AGENTS.md` at the cookbook.

### Changes Required:

#### 1. Fill cookbook §6.1–6.3 and pin the runner

**File**: `context/foundation/test-plan.md`

**Intent**: Replace TBD placeholders with the patterns this change shipped.

**Contract**:

- **§6.1** — where unit files live, `tests/unit/`, explicit `vitest` imports, no `astro:env` in units, `npm test` / unit path without a server.
- **§6.2** — two cookie sessions; 404 vs 200-empty; never 403 for cross-manager; guest 401 **and** empty body; page 302 via HTTP not Playwright; fixture unique names + A cleanup.
- **§6.3** — a new product API gets: `requireApiAuth` 401 guest check + one ownership check with a second session (read and one write), not happy-path CRUD only.
- **§4** — Vitest row: pinned version actually installed; notes that HTTP integration uses `vitest/config` `defineConfig` (getViteConfig deferred until a phase needs Astro component tests).
- **§3** — this rollout row stays `planned` until implement starts; do not mark `complete` here.
- **§6.4–6.6** stay TBD / Phase 2–3.

Optional 2–3 line note under §6.6 if something surprising showed up (cookie capture, 200-empty lists).

#### 2. AGENTS cookbook pointer

**File**: `AGENTS.md`

**Intent**: Agents adding tests read the cookbook instead of inventing a second layout.

**Contract**: Testing section points at `context/foundation/test-plan.md` §6. Repeat: CI does not run tests until rollout Phase 3. Isolation tests need two documented managers and a live app (`globalSetup` or `TEST_BASE_URL`).

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.1, §6.2, and §6.3 no longer read “TBD — see §3 Phase 1”
- `npm test` still passes after doc-only edits
- `npm run lint` / Prettier on the touched markdown

#### Manual Verification:

- Reading §6.2 alone is enough to know how to add a third-manager-style check for a new by-id route (cookie helper, 404, empty body, no 403)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Page prefixes are protected; `/`, `/auth/*`, and `/api/*` are not (`tests/unit/protected-routes.test.ts`)
- Do not unit-test `requireApiAuth` by mocking `getUser` — that would mirror the implementation. Guest deny is an HTTP integration.

### Integration Tests:

- Harness smoke: A and B can `GET /api/teams` as 200
- Guest: 401 + empty product payloads; protected pages 302; `/` stays 200
- Cross-manager: representative read/write matrix; 200-empty vs 404 split; A unchanged; cleanup

### Manual Testing Steps:

1. `npm test` with no server in Phase 1 — unit file only.
2. Create/confirm Manager B on cloud; copy env vars; `npm test` boots or reuses `astro dev`.
3. After Phase 3, open `/dashboard` as A and confirm no leftover `iso-*` fixtures.
4. Optional: sign in as B in the browser and open A’s employee URL — UI hide is not the proof; the API tests are.

## Performance Considerations

`astro dev` (workerd) startup dominates wall time. Reuse an already-bound `TEST_BASE_URL`. Unique fixtures keep the suite from scanning “all of A’s people.” Do not add coverage gates in this change.

## Migration Notes

No schema. Cloud data: only unique `iso-*` rows this suite creates, then soft-deletes. Existing Manager A data is read for lists but not deleted. Document that isolation tests share the cloud project with manual use.

## References

- Frame brief: `context/changes/testing-isolation-runner-bootstrap/frame.md`
- Test plan: `context/foundation/test-plan.md` §2–§5, §7
- Test accounts: `context/foundation/test-accounts.md`
- Authz: `src/lib/api-auth.ts`, `src/middleware.ts`, `src/lib/supabase.ts`
- Product APIs: `src/pages/api/{teams,employees,meetings,tasks}.ts` and `[id].ts` siblings
- RLS: `supabase/migrations/20260727000001_create_teams_and_employees.sql`, `supabase/migrations/20260810105659_create_meetings_and_tasks.sql`
- Prior manual stamp: `context/archive/2026-07-24-create-team-and-employee/plan.md` step 9 / 3.8
- Astro testing (Vitest `getViteConfig`, unused here): https://docs.astro.build/en/guides/testing/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner home

#### Automated

- [x] 1.1 `npm test` (or `npx vitest run tests/unit`) passes with no `TEST_BASE_URL`, no manager env, and no listening app — ae53ef0
- [x] 1.2 `npm run lint` passes including `tests/` and `src/lib/protected-routes.ts` — ae53ef0
- [x] 1.3 `npm run build` still succeeds with existing `SUPABASE_*` env — ae53ef0

#### Manual

- [x] 1.4 Terminal output from `npm test` shows the unit file ran and passed — the visible “runner home” done-state — ae53ef0

### Phase 2: Two-session harness

#### Automated

- [x] 2.1 `npm test` starts or reuses `astro dev` and the harness smoke passes when `.env` has both managers — 3360f2c
- [x] 2.2 Missing `TEST_MANAGER_B_*` fails with an actionable message (not an uncaught 401) — 3360f2c
- [x] 2.3 `npm run lint` still passes — 3360f2c

#### Manual

- [x] 2.4 Manager B can log in at `/auth/signin` on the local app against cloud Supabase (email confirmed) — 3360f2c
- [x] 2.5 Both accounts are listed in `test-accounts.md` with purpose “isolation tests / Phase 1” — 3360f2c

### Phase 3: Isolation proofs

#### Automated

- [x] 3.1 Guest isolation file passes (401 + empty payloads; page 302; `/` not redirected) — 5022ddc
- [x] 3.2 Cross-manager file passes the matrix above plus A’s unchanged re-read — 5022ddc
- [x] 3.3 After a green run, A no longer GET-200s the unique fixture employee/team (cleanup) — 5022ddc
- [x] 3.4 Full `npm test` passes (unit + harness smoke + isolation) — 5022ddc

#### Manual

- [x] 3.5 A’s dashboard after the suite does not show leftover `iso-*` people/teams from this run — 5022ddc
- [x] 3.6 Spot-check one failing assertion mentally: if B GET meeting returned 200 with notes, the test would fail (oracle is “no A payload,” not “status is 404 because the handler says so”) — 5022ddc

### Phase 4: Cookbook

#### Automated

- [x] 4.1 `context/foundation/test-plan.md` §6.1, §6.2, and §6.3 no longer read “TBD — see §3 Phase 1” — 5485425
- [x] 4.2 `npm test` still passes after doc-only edits — 5485425
- [x] 4.3 `npm run lint` / Prettier on the touched markdown — 5485425

#### Manual

- [x] 4.4 Reading §6.2 alone is enough to know how to add a third-manager-style check for a new by-id route (cookie helper, 404, empty body, no 403) — 5485425
