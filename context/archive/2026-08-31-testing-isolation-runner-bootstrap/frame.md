# Frame Brief: Isolation + runner bootstrap

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

Phase 1 of `context/foundation/test-plan.md` is opened as “Isolation + runner
bootstrap”: prove manager-to-manager isolation (risk #1) and guest isolation
(risk #2), and add Vitest so later phases have a home. There is no test runner
today. Test types named: unit + API integration. Isolation has not been
observed as a leak.

## Initial Framing (preserved)

- **User's stated cause or approach**: Isolation is proven at the product API
  with two cookie sessions (not pgTAP/Docker, not Playwright). Risk #1 must
  challenge “logged in ≠ owns this row” and “UI hide ≠ API deny.” Risk #2 must
  challenge “middleware on pages implies APIs are gated.”
- **User's proposed direction**: Plan this Phase 1 as written — bootstrap the
  runner and write isolation tests for both risks in one change.
- **Pre-dispatch narrowing**: Leading concern is the missing runner so later
  phases have a home. Isolation is unproven, not observed broken. (“There is
  no test suite; Phase 1 is mainly getting a runner so later phases have a
  home.” / “We have not seen a leak; nothing currently proves isolation
  holds.”)

## Dimension Map

The observation could originate at any of these dimensions:

1. **Runner absence** — no Vitest, no `test` script, no test files; AGENTS.md
   forbids inventing a runner. Later phases have nowhere to land. ← leading
   concern after Step 1.5
2. **Isolation proofs bundled as first occupants** — test-plan Phase 1 treats
   runner bootstrap and risks #1/#2 as one change. Isolation API tests (two
   sessions, cloud Supabase) may be a different problem riding along.
3. **Harness / fixtures** — “nothing proves isolation” may come from having
   one test account and no two-cookie harness, not from missing Vitest.
4. **Authz already exists at API + RLS** — `requireApiAuth` returns 401; RLS
   is `auth.uid() = manager_id`; page middleware does not cover `/api`. What’s
   missing may be proof of existing gates, not the gates themselves.

## Hypothesis Investigation

| Hypothesis                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Verdict                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Runner absence                       | No `test` script or vitest/jest/playwright deps (`package.json:5–12`, `:14–61`); zero configs and zero `*.test.*` files; `AGENTS.md:30–32` forbids inventing a runner; CI is lint+build only (`.github/workflows/ci.yml:18–24`); stack-assessment `test_runner: null`; health-check treats it as a known accepted gap                                                                                                                                                             | STRONG                                                       |
| Isolation bundled as first occupants | Phase name and goal line glue two imperatives (`test-plan.md` §3 row 1); skill templates “runner + first integration on Risk #1” for a `none` test base; cost of #1 is two cookie sessions vs a unit file. User later said this change **must** still leave #1 and #2 proven — bundle is intended, not accidental                                                                                                                                                                 | STRONG as description; **ruled out as a split** by narrowing |
| Harness / fixtures                   | One documented account (`context/foundation/test-accounts.md`); cookie-only SSR (`src/lib/supabase.ts:9–22`, `src/lib/api-auth.ts:7–24`); no seed/fixture/second-user factory; §4 forbids Phase 1 depending on `supabase start`. User has not checked whether a second cloud manager exists                                                                                                                                                                                       | STRONG for risk #1; N/A for risk #2 (no cookie)              |
| Authz already exists                 | All eight product APIs call `requireApiAuth` (`src/lib/api-auth.ts:20–21`); `PROTECTED_ROUTES` is pages only (`src/middleware.ts:4`); RLS `auth.uid() = manager_id` on teams/employees/meetings/tasks. Handlers collapse invisible rows to 404 via `maybeSingle`, not ownership `if`s. No product API skips the gate. Isolation was once checked manually for teams/employees (`context/archive/2026-07-24-create-team-and-employee/plan.md` step 9 / 3.8) and never made durable | STRONG                                                       |

## Narrowing Signals

Decisive observations from Step 4 (user reports + sub-agent findings) that
narrowed the hypothesis space:

- Phase 1 **done looks like** a test command that can run a file (runner home),
  not “isolation proven” as the visible success criterion.
- This change **must still leave isolation #1 and #2 proven** — do not drop
  isolation into a later change.
- Second manager on cloud: **not checked**.
- Independent search: the gap is an accepted AGENTS.md “no runner until a
  product decision” policy plus one-shot manual isolation that never became a
  suite — not a silent discovery that isolation was never thought about.
- Inverse: if gates were missing we would see ungated product APIs or tables
  without RLS; we do not. A prior stamp-trust gap on `completedMeetingId` was
  already fixed (archive person-overview impl-review F1).

## Cross-System Convention

For a `none` test base, `/10x-test-plan` templates Phase 1 as bootstrap the
runner **plus** the first integration test on the top isolation risk. Isolation
is proven at the product API with two sessions, not pgTAP. CI enforcement waits
for Phase 3. That convention matches keeping runner + #1/#2 in this change, and
matches treating isolation tests as proofs of existing gates rather than new
controls.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: there is no test runner, so
> existing isolation gates have no durable automated proof — and this change
> is the product decision that both creates the home and occupies it with
> proofs of risks #1 and #2.

The initial **scope** was correct: do not split runner bootstrap from isolation
#1/#2, and do not make Phase 1 depend on Docker, Playwright, or CI wiring
(Phase 3). What was mislocated is the **nature** of the isolation work: guest
deny already lives in `requireApiAuth` (middleware never covers `/api`);
cross-manager deny already lives in RLS (`auth.uid() = manager_id`). Tests
lock that behavior; they do not add a missing control. The visible done-state
is `npm test` (or equivalent) running a file; the required first occupants of
that suite are the two isolation proofs. Risk #1 cannot be evidenced without
two cloud cookie sessions; that harness is currently undocumented and
unverified.

## Confidence

- **MEDIUM** — evidence and convention agree on the problem statement;
  feasibility of risk #1 still hinges on an unchecked second cloud manager.

Before /10x-plan treats #1 as implementable: confirm whether two managers
already exist on the cloud project tests will hit, or treat creating and
documenting a second account as in-scope for this change.

## What Changes for /10x-plan

Plan the Phase 1 bundle as written (Vitest home + isolation #1 and #2), not a
runner-only placeholder and not new authz. Isolation tests take their oracle
from the test-plan risk responses, not from current handler code; two cloud
cookie sessions are a load-bearing dependency for #1; guest #2 needs no
account; CI gates stay Phase 3.

## References

- Source files: `package.json:5–12`; `AGENTS.md:30–32`; `src/middleware.ts:4–21`;
  `src/lib/api-auth.ts:7–24`; `src/lib/supabase.ts:9–22`;
  `supabase/migrations/20260727000001_create_teams_and_employees.sql:30–67`;
  `supabase/migrations/20260810105659_create_meetings_and_tasks.sql:40–77`;
  `.github/workflows/ci.yml:18–24`; `context/foundation/test-accounts.md`;
  `context/foundation/test-plan.md` §2–§5, §7; `context/foundation/prd.md`
  privacy guardrail
- Related research: none yet (`research.md` not present)
- Investigation tasks: runner absence `ad8d3345-5cb0-4f38-b7cd-8c1d213d1041`;
  isolation bundle `ad361770-2438-4a27-a019-2e2f44eaf76e`; harness
  `ee9ccc75-b43d-4a21-adcc-82a30164ea1c`; authz already exists
  `6fd51dc1-1a5a-43d4-bf09-3dc06f285cec`; independent search
  `4faa75b0-d72e-4476-93b5-8097eec4cc5d`
