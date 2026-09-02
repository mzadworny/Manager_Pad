# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-02

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src`, `supabase/migrations`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                 | Impact | Likelihood | Source (evidence — not anchor)                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Logged-in manager A can read or write manager B’s people, meetings, notes, or tasks                                     | High   | High       | interview Q1; PRD privacy guardrail; hot-spot dir `src/pages/api` (18 commits/30d)                               |
| 2   | A guest / unauthenticated request can read any manager’s data (page or API)                                             | High   | Medium     | interview Q1; PRD “private to the logged-in manager”; archive login + protected-routes work                      |
| 3   | Live meeting notes, topics, or tasks silently fail to persist (looks saved, gone after reload / tab switch)             | High   | High       | PRD autosave NFR; archive meeting-capture; interview Q3; hot-spot dir `src/components/meetings` (14 commits/30d) |
| 4   | Person overview or meeting side panel shows the wrong person’s tasks or the wrong meeting’s notes                       | High   | High       | interview Q3; archive person-overview; hot-spot dir `src/components/employees` (15 commits/30d)                  |
| 5   | Completing a meeting does not freeze capture — a late autosave overwrites wrap-up after complete                        | Medium | Medium     | archive finalize (complete/reopen race); interview Q3; hot-spot dir `src/components/meetings`                    |
| 6   | Task complete/add from the overview does not stick, or “closed in this meeting” is stamped wrong, so follow-up is a lie | Medium | High       | PRD US-01; archive person-overview; interview Q3                                                                 |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                    | Must challenge                                                   | Context `/10x-research` must ground                                | Likely cheapest layer                                                                          | Anti-pattern to avoid                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| #1   | Manager B’s ids never return A’s notes/tasks/people (read and write)                                                                           | “Logged in” ≠ “owns this row”; UI hide ≠ API deny                | Auth/session shape; how APIs take ids; RLS vs handler checks       | Integration (two cookie sessions against product APIs)                                         | Happy-path CRUD only; asserting current handler code as the oracle   |
| #2   | Unauthenticated GET/POST to product APIs and protected pages is 401/redirect, empty of notes/tasks                                             | Middleware on pages implies APIs are gated                       | Which routes are public vs protected; cookie vs header auth        | Integration (no cookie) + one browser smoke for a gated page                                   | e2e of the landing page; checking status only while JSON still leaks |
| #3   | After debounce, reload (or new session) shows the same notes/topics/tasks; failure shows error + retry, not a fake Saved                       | Saved UI = 2xx; in-tab state = persisted                         | Autosave contract; what “persisted” means across Astro remount     | Integration on PATCH + one capture-path check                                                  | Mocking the save function and asserting it was called                |
| #4   | Overview selector and meeting panel lists are this employee’s tasks / this meeting’s note; swapping person/meeting does not keep stale content | Empty list = no tasks; meeting panel = origin-meeting tasks only | How person-level vs meeting-origin tasks are listed; selector swap | Integration on list APIs; thin UI check for stale swap if research says the bug is client-only | Snapshot of the three-column layout                                  |
| #5   | After complete, content writes are rejected; reopen required before wrap-up changes stick                                                      | Status label = server freeze                                     | Complete/reopen API contract; debounce vs status PATCH ordering    | Integration on meeting PATCH while completed                                                   | Replaying the UI click sequence as the only test                     |
| #6   | Overview complete still done after reload; meeting complete stamps “closed here”; uncomplete clears the stamp                                  | Overview complete = meeting-panel complete                       | Origin vs person-level task; completed vs closed-in-meeting stamp  | Integration on task POST/PATCH                                                                 | Copying DTO field names into expects with no independent rule        |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                   | Goal (one line)                                                                                              | Risks covered  | Test types                                                                          | Status      | Change folder                      |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------- | ----------- | ---------------------------------- |
| 1   | Isolation + runner bootstrap | Prove manager-to-manager and guest isolation at the cheapest layer; add Vitest so later phases have a home   | #1, #2         | unit + API integration                                                              | planned     | testing-isolation-runner-bootstrap |
| 2   | Capture and overview         | Prove persist + correct person/meeting lists on the two unconfident surfaces; include complete/reopen freeze | #3, #4, #5, #6 | integration (+ e2e only if research shows a remount/stale-UI bug APIs cannot catch) | not started | —                                  |
| 3   | Quality-gates wiring         | CI runs the suite; AGENTS.md points at this cookbook                                                         | cross-cutting  | gates                                                                               | not started | —                                  |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session. If a useful docs
or search MCP such as Context7 or Exa.ai is not available, say that instead
of assuming access.

| Layer                | Tool       | Version                                           | Notes                                                                                                                                                       |
| -------------------- | ---------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration   | Vitest     | 4.1.11 (`vitest` ^4.1.11)                         | HTTP integration uses `defineConfig` from `vitest/config`. Astro `getViteConfig` is deferred until a phase needs component tests (unfiltered config crash). |
| API mocking          | none       | n/a                                               | Prefer real auth cookies + product APIs over mocking internals. Mock only at the network edge if an external service is required.                           |
| e2e                  | Playwright | none yet — see §3 Phase 2 if research requires it | Official Astro path: `webServer` + `npm run preview`. Do not add in Phase 1.                                                                                |
| accessibility        | none yet   | n/a                                               | Not a top risk; do not bootstrap here.                                                                                                                      |
| RLS / DB             | pgTAP      | not default                                       | Official Supabase path, but local Docker is optional; default target is cloud. Do not make Phase 1 depend on `supabase start`.                              |
| (optional) AI-native | none       | n/a                                               | Playwright MCP not in session; landing copy is §7. No vision review.                                                                                        |

**Stack grounding tools (current session):**

- Docs: none (Context7 not available in current session) — official Astro/Playwright/Supabase pages fetched via search; checked: 2026-08-31
- Search: Exa.ai — Astro 6 testing + Vitest `getViteConfig` caveat; Playwright `webServer`; checked: 2026-08-31
- Runtime/browser: Playwright MCP not available in current session — not used; checked: 2026-08-31
- Provider/platform: Supabase docs MCP — pgTAP/RLS testing is current; Linear MCP needs auth, unused; checked: 2026-08-31

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase \<N\>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate               | Where                   | Required?                                              | Catches                                |
| ------------------ | ----------------------- | ------------------------------------------------------ | -------------------------------------- |
| lint + typecheck   | local + CI              | required (already wired)                               | syntactic / type drift                 |
| unit + integration | local + CI              | required after §3 Phase 3 (suite exists after Phase 1) | isolation + persist + list regressions |
| pre-prod smoke     | browser, login into app | required (already in AGENTS.md)                        | post-login lands in the app            |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase \<N\>."

### 6.1 Adding a unit test

Put the file in `tests/unit/` as `*.test.ts`. Import `describe` / `it` / `expect` from `vitest` (globals are off). Do not import `astro:env/server` or `src/lib/supabase.ts` — those do not resolve inside Vitest. Path alias `@/*` → `src/*` works from tests. Run just units with `npx vitest run tests/unit` (no live app). `npm test` runs the whole suite, including integration.

### 6.2 Adding an isolation (authz/authn) integration test

Use two cookie jars from `signIn()` in `tests/helpers/session.ts` (form POST `/api/auth/signin`, `redirect: "manual"`, replay `Set-Cookie`). Credentials live in `.env` (`TEST_MANAGER_*`); see `context/foundation/test-accounts.md`. `globalSetup` starts or reuses `astro dev` at `TEST_BASE_URL` (default `http://localhost:4321`).

For a new by-id route, as Manager B against A's id:

- Expect **404** and **no** `employee` / `meeting` / `task` / `notesJson` payload — not 403. 403 means the All people system team, not “not your row.”
- List-by-foreign-**employee** is the trap: `GET /api/meetings?employeeId=` and `GET /api/tasks?employeeId=` are **200** with an empty array. `GET /api/tasks?meetingId=` and `GET /api/employees?teamId=` are **404** when the parent is invisible.
- Then as A, re-read the same ids and assert the row is unchanged.

Guest (no `Cookie`): product GET + one mutating method → **401** `{ error: "Unauthorized" }` **and** parsed JSON must not contain populated `teams` / `employees` / `meetings` / `tasks` / `notesJson` / `notes`. Protected pages (`/dashboard`, `/employees`, `/meetings`) via HTTP `redirect: "manual"` → **302/303** whose `Location` path is `/auth/signin`. Do not use Playwright. Fixtures use unique `iso-<run>-…` names; Manager A soft-deletes the fixture employee (cascades meetings/tasks) then the unique team. Never delete All people.

### 6.3 Adding a test for a new API endpoint

A new product API is not done with happy-path CRUD. Add:

1. Guest deny: unauthenticated GET and one write → 401 and empty of notes/tasks/people (§6.2).
2. Ownership: Manager B reads A's id and attempts one write (PATCH or DELETE). Expect 404 (or 200-empty if this is a list-by-employee endpoint) with no A's payload; A’s re-read is unchanged.

Do not mock `requireApiAuth`, Supabase, or RLS. Do not treat UI hide as the proof.

### 6.4 Adding a capture or overview regression test

TBD — see §3 Phase 2 for persist-after-reload, wrong-person/wrong-meeting lists, and complete/reopen freeze.

### 6.5 Wiring a CI test gate

TBD — see §3 Phase 3.

### 6.6 Per-rollout-phase notes

- Isolation + runner bootstrap: form POST `/api/auth/signin` needs an `Origin` header matching the app origin, or Astro `checkOrigin` returns 403 before the handler. Capture cookies with `redirect: "manual"` so `Set-Cookie` is not dropped. Cross-manager is never 403; meetings/tasks listed by a foreign `employeeId` are 200-empty.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Landing-page copy and marketing layout** — they change often and do not protect notes/tasks. Re-evaluate if the public page starts collecting data or running authenticated queries. (Source: Phase 2 interview Q5.)
- **Visual snapshot / vision review of `/`** — no data at risk; brittle. Re-evaluate if a visual regression would hide auth CTAs in a way that blocks signup. (Source: Phase 2 interview Q5 + cost × signal.)
- **pgTAP-first RLS suite** — not unless the team opts into local Supabase. Isolation is proven at the product API with two sessions. Re-evaluate if Docker-local becomes the default. (Source: tech-stack + AGENTS local-Supabase rule.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-08-31
- Stack versions last verified: 2026-09-02
- AI-native tool references last verified: 2026-08-31

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
