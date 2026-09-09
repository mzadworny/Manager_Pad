# Guest by-id isolation proofs Implementation Plan

## Overview

Extend the existing guest suite so every by-id product handler — and `GET /meetings` — fails if an unauthenticated request can read or write manager data. Tests lock `requireApiAuth` and page middleware. They do not add new authz.

## Current State Analysis

Risk #2 is already proven for **collection** GET/POST (`/api/teams`, `/api/employees`, `/api/meetings`, `/api/tasks`) and for pages `/dashboard` and `/employees`. Cookbook §6.2 already names `/meetings` as a protected page; the HTTP test never hits it.

By-id handlers live in **separate modules** (`src/pages/api/{teams,employees,meetings,tasks}/[id].ts`). Each calls `requireApiAuth` first. Collection tests would stay green if one of those files dropped the call. Research named this remainder: without auth, a well-formed unknown id is **404** (no row / anon has no SELECT), not **401**, and JSON is still empty of notes — so status-only-as-404 looks like a deny while the gate is gone.

`PROTECTED_ROUTES` is prefix-matched (`/dashboard`, `/employees`, `/meetings`). `/api/*` is not in that list. Product Astro pages only pass URL ids into islands; they do not SSR notes. Guest page leak is the redirect; API leak is a 401 body that must also be empty of product keys.

## Desired End State

`npm test` fails if a guest can read or mutate through a by-id product path, or if `GET /meetings` no longer redirects to sign-in:

- Guest GET/PATCH/DELETE on `/api/employees/:id`, `/api/meetings/:id`, `/api/tasks/:id` (PATCH/DELETE only), and `/api/teams/:id` (PATCH/DELETE only) is **401** `{ error: "Unauthorized" }` with no populated `employee` / `meeting` / `task` / `team` / notes payload.
- Guest `GET /api/tasks?meetingId=` (synthetic UUID) is the same 401 + empty.
- Guest `GET /meetings` is **302/303** whose `Location` path is `/auth/signin`. Existing `/dashboard`, `/employees`, and public `/` assertions stay.

Cookbook §6.2 tells a later author that guest by-id is **401 not 404**. CI still does not run tests.

### Key Discoveries:

- Isolation oracles stay in `context/foundation/test-plan.md` §2, not handler `if`s (`src/lib/api-auth.ts:20-21`)
- Collection and by-id are different files — proving `GET /api/meetings` does not prove `GET /api/meetings/[id]` (`src/pages/api/meetings.ts` vs `src/pages/api/meetings/[id].ts:48-51`)
- `requireApiAuth` runs before UUID parse; dropped auth on a well-formed unknown id is 404 `{ error: "Meeting not found" }` (or equivalent), empty of notes (`src/pages/api/meetings/[id].ts:47-72`)
- `populatedProductKeys` already flags singular `meeting` / `employee` / `task` / `team` objects (`tests/helpers/http.ts:82-86`) — nested `notesJson` is caught via the `meeting` object
- Page `/meetings` is prefix-protected and unit-tested; the guest HTTP loop omits it (`tests/integration/guest-isolation.test.ts:37`, `src/lib/protected-routes.ts:1-4`)

## What We're NOT Doing

- Real manager UUIDs, fixtures, or cookie sessions in the guest file
- Playwright, pgTAP, Docker, or CI wiring (rollout Phase 3)
- New authz, new RLS, anon SELECT policies, or handler ownership `if`s
- Remaining cross-manager leftovers (risk #1)
- Capture / overview persist tests (test-plan §3 Phase 2)
- Auth routes as product APIs; landing-page copy (§7)
- Mocking `requireApiAuth`, Supabase, or RLS
- Overwriting archived isolation plans

## Implementation Approach

Keep one guest file and the existing `expectGuestUnauthorized` / `guestFetch` helpers. Add the missing by-id methods and `GET /api/tasks?meetingId=` with `WELL_FORMED_UUID`. Add `/meetings` to the page redirect loop. Then a short cookbook note so 401 vs 404 is not rediscovered.

Two phases: proofs first (the signal), then cookbook.

## Critical Implementation Details

**401 is the guest oracle, not 404.** `requireApiAuth` returns before the UUID lookup. If that call is removed, a synthetic id still yields 404 and an empty product body — the anti-pattern the test-plan names (status that looks like deny while JSON does not leak). PATCH bodies must be schema-valid (`name`, `topics`, or `title`) so dropped-auth cannot 400 on parse before that 404.

---

## Phase 1: Guest by-id + /meetings proofs

### Overview

Every by-id product method and the missing protected-page prefix fail the suite when a guest is allowed through. No new fixtures. Existing collection and `/` assertions stay.

### Changes Required:

#### 1. By-id and meetingId guest attacks

**File**: `tests/integration/guest-isolation.test.ts`

**Intent**: Prove page middleware does not gate APIs, and that each by-id module still calls `requireApiAuth`. Challenge status-only while JSON leaks, and 404-as-deny.

**Contract**: No `Cookie`. Reuse `expectGuestUnauthorized` (401, `{ error: "Unauthorized" }`, `populatedProductKeys` empty). Paths use `WELL_FORMED_UUID` from `tests/helpers/http.ts`. Do not sign in. Do not create rows.

| Guest request               | Body (if any)                                |
| --------------------------- | -------------------------------------------- |
| `GET /api/employees/:id`    | —                                            |
| `PATCH /api/employees/:id`  | `{ name }`                                   |
| `DELETE /api/employees/:id` | —                                            |
| `GET /api/meetings/:id`     | —                                            |
| `PATCH /api/meetings/:id`   | `{ topics }` (or another schema-valid field) |
| `DELETE /api/meetings/:id`  | —                                            |
| `PATCH /api/tasks/:id`      | `{ title }`                                  |
| `DELETE /api/tasks/:id`     | —                                            |
| `PATCH /api/teams/:id`      | `{ name }`                                   |
| `DELETE /api/teams/:id`     | —                                            |
| `GET /api/tasks?meetingId=` | —                                            |

Keep the existing collection GET/POST cases. Do not expect 404. Do not treat 403 as guest deny. Do not assert by copying handler error strings beyond `{ error: "Unauthorized" }`. Do not use Playwright.

#### 2. Protected page `/meetings`

**File**: `tests/integration/guest-isolation.test.ts`

**Intent**: Cookbook already lists three prefixes; HTTP must hit the third so removing `/meetings` from middleware is not only a unit-test concern.

**Contract**: Same `redirect: "manual"` loop as `/dashboard` and `/employees`. Expect **302/303** and `Location` path `/auth/signin`. Negative control `GET /` unchanged. Do not fetch `/employees/:id` or `/meetings/:id` (prefix unit test already covers those; pages do not SSR notes).

### Success Criteria:

#### Automated Verification:

- `npx vitest run tests/integration/guest-isolation.test.ts` passes the new by-id rows, `?meetingId=`, `/meetings` redirect, and the existing collection + `/dashboard` + `/employees` + `/` cases
- Full `npm test` still passes (unit + harness smoke + guest + cross-manager)
- `npm run lint` passes including `tests/`

#### Manual Verification:

- Spot-check: if `GET /api/meetings/:id` as guest returned 404 `{ error: "Meeting not found" }` with no `meeting` object, the test would fail (oracle is 401, not “no row”)
- `curl -I` (or equivalent) of guest `GET /meetings` against the test origin is 302/303 to `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Cookbook by-id guest note

### Overview

Later endpoints should copy guest by-id as 401, not “404 means denied.”

### Changes Required:

#### 1. Isolation cookbook note

**File**: `context/foundation/test-plan.md`

**Intent**: §6.2 currently says product GET + one mutating method. It does not say by-id is 401 rather than 404, or that a synthetic UUID is enough.

**Contract**:

- **§6.2** — guest by-id GET/PATCH/DELETE on `/api/{employees,meetings,tasks,teams}/:id` (methods that exist) are **401** with `{ error: "Unauthorized" }` and no product payload — **not 404**. 404 means the handler ran without `requireApiAuth`. `WELL_FORMED_UUID` is enough; do not create a real row. `GET /api/tasks?meetingId=` is the same 401. Protected pages include `/meetings` (already named; keep it listed).
- **§6.6** — one short bullet: guest by-id uses synthetic UUID; auth returns before lookup; 401 ≠ 404.
- **§3 / §4 / §7** — do not change rollout status, stack pins, or exclusions. Do not mark CI as required.

Do not edit `AGENTS.md` unless the Testing paragraph no longer points at §6 (it already does). Do not edit `health-check.md` / `stack-assessment.md`.

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.2 names guest by-id as 401 not 404, with synthetic UUID
- `npm test` still passes after doc-only edits
- Prettier on the touched markdown (`npm run format` scoped to that file, or the repo format command already used for markdown)

#### Manual Verification:

- Reading §6.2 alone is enough to know why a guest 404 on `/api/meetings/:id` is a failed proof, not a pass

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- None new. `tests/unit/protected-routes.test.ts` already locks `/api` ungated and `/meetings/…` protected. Do not unit-test `requireApiAuth` by mocking `getUser`.

### Integration Tests:

- Existing collection guest cases unchanged
- New: 10 by-id methods + `GET /api/tasks?meetingId=` as guest; `/meetings` redirect
- Cross-manager suite unchanged

### Manual Testing Steps:

1. `npm test` with `.env` managers and `astro dev` reused or started by `globalSetup` (guest file does not need accounts; the rest of the suite does).
2. Confirm a guest `GET /api/meetings/<uuid>` is 401, not 404.
3. Confirm a guest `GET /meetings` redirects to `/auth/signin`.

## Performance Considerations

No extra cloud rows. Reuse `TEST_BASE_URL`. Do not add coverage gates.

## Migration Notes

No schema. Guest tests send a synthetic UUID and never write. Existing Manager A/B data is untouched.

## References

- Related research: `context/archive/2026-08-31-testing-isolation-runner-bootstrap/research.md` (open question: guest by-id)
- Parent isolation change: `context/archive/2026-08-31-testing-isolation-runner-bootstrap/plan.md`
- Sibling follow-on (risk #1 writes): `context/archive/2026-09-07-isolation-high-signal-writes/plan.md`
- Test plan: `context/foundation/test-plan.md` §2 risk #2, §6.2, §7
- Authn gate: `src/lib/api-auth.ts`, `src/pages/api/meetings/[id].ts`, `src/middleware.ts`, `src/lib/protected-routes.ts`
- Harness: `tests/helpers/http.ts`, `tests/integration/guest-isolation.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Guest by-id + /meetings proofs

#### Automated

- [ ] 1.1 `npx vitest run tests/integration/guest-isolation.test.ts` passes the new by-id rows, `?meetingId=`, `/meetings` redirect, and the existing collection + `/dashboard` + `/employees` + `/` cases
- [ ] 1.2 Full `npm test` still passes (unit + harness smoke + guest + cross-manager)
- [ ] 1.3 `npm run lint` passes including `tests/`

#### Manual

- [ ] 1.4 Spot-check: if `GET /api/meetings/:id` as guest returned 404 `{ error: "Meeting not found" }` with no `meeting` object, the test would fail (oracle is 401, not “no row”)
- [ ] 1.5 `curl -I` (or equivalent) of guest `GET /meetings` against the test origin is 302/303 to `/auth/signin`

### Phase 2: Cookbook by-id guest note

#### Automated

- [ ] 2.1 `context/foundation/test-plan.md` §6.2 names guest by-id as 401 not 404, with synthetic UUID
- [ ] 2.2 `npm test` still passes after doc-only edits
- [ ] 2.3 Prettier on the touched markdown (`npm run format` scoped to that file, or the repo format command already used for markdown)

#### Manual

- [ ] 2.4 Reading §6.2 alone is enough to know why a guest 404 on `/api/meetings/:id` is a failed proof, not a pass
