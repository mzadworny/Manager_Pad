# High-signal cross-manager write proofs Implementation Plan

## Overview

Add three product-API isolation proofs that the Phase 1 representative matrix skipped: B cannot PATCH A’s task, cannot stamp B’s own task with A’s meeting, and cannot create a meeting or floating task on A’s person. Tests lock existing gates (`requireApiAuth` + RLS + parent lookup). They do not add ownership `if`s, RLS, or FK constraints.

## Current State Analysis

Risk #1 is already proven for a **representative** surface in `tests/integration/cross-manager-isolation.test.ts` (two cookie sessions, unique `iso-*` fixtures, 404 vs 200-empty, A re-read). Cookbook §6.2 tells later authors how to add a by-id check. That matrix never sends `PATCH /api/tasks/:id`, `POST /api/meetings` with a foreign `employeeId`, or `POST /api/tasks` with a foreign `employeeId` only.

Research located the failure at RLS + empty `maybeSingle`, not handler ownership branches. The historically real hole was F1: `completedMeetingId` accepted any meeting UUID because RLS only proves the **task** is the caller’s. The API now looks up the meeting under RLS (`src/pages/api/tasks/[id].ts`); isolation tests never exercise that path. PATCH-ing **A’s** task id 404s before the meeting lookup — the F1 attack needs **B’s own task** plus A’s meeting id.

Frame for the parent change (`testing-isolation-runner-bootstrap`) already settled: proofs of existing gates, not new authz; never 403 for “not your row”; no Playwright / pgTAP / CI in this layer.

## Desired End State

`npm test` still boots or reuses `astro dev` and the existing isolation suite. Three additional cases fail if B can write through A’s person/meeting/task ids:

- B `PATCH /api/tasks/:id` on A’s task is **404** with no `task` payload.
- B `PATCH` B’s own task with `completedAt` + A’s `completedMeetingId` is **404**; B’s task still has `completedMeetingId: null`; A’s meeting is unchanged.
- B `POST /api/meetings` with A’s `employeeId` is **404** with no `meeting` payload; A’s meeting list for that person still contains only the fixture meeting.
- B `POST /api/tasks` with A’s `employeeId` only is **404** with no `task` payload; A’s task list for that person still contains only the fixture task.

Cookbook §6.2 names create-on-foreign-employee and stamp-on-foreign-meeting so a later endpoint copies the right attack, not only “PATCH the other manager’s id.” CI still does not run tests.

### Key Discoveries:

- Isolation oracles stay in `context/foundation/test-plan.md` §2, not handler `if`s (`src/lib/api-auth.ts:20-21`; RLS `auth.uid() = manager_id`)
- F1 stamp branch runs only when `completedAt` is non-null **and** `completedMeetingId` is set (`src/pages/api/tasks/[id].ts:54-88`). PATCH A’s task never reaches the meeting lookup
- `POST /api/meetings` and floating `POST /api/tasks` 404 after an RLS parent probe (`src/pages/api/meetings.ts:68-78`, `src/pages/api/tasks.ts:151-165`)
- B can create a person with `teamId: null` (All people), then a floating task on that person — do not assign to the system team (400)
- Cross-manager is never 403; 403 is own system-team rename/delete

## What We're NOT Doing

- Database triggers, same-manager FK checks, or reopening F1 Fix B
- The rest of the research leftover matrix (team PATCH/DELETE, employee `teamId` steal, meeting `notesJson`/status, DELETE employee/meeting)
- Guest by-id routes, Playwright, pgTAP, Docker, CI wiring (rollout Phase 3)
- New authz, new RLS, or handler ownership `if`s
- Overwriting `context/changes/testing-isolation-runner-bootstrap/plan.md`
- Happy-path CRUD, capture/overview persist tests, landing-page assertions
- Mocking `requireApiAuth`, Supabase, or RLS

## Implementation Approach

Keep one suite and one A-owned fixture. Extend the existing cross-manager file and helpers. Add a **B-owned** person + floating task only for the stamp attack, cleaned up as B (soft-delete that employee; never touch All people). Oracles: 404 + empty product payload + A (and B) re-read unchanged.

Two phases: proofs first (the signal), then a short cookbook note so the stamp gotcha is not rediscovered.

## Critical Implementation Details

**Stamp attack is not “PATCH A’s task.”** If B sends `completedMeetingId` against A’s task id, the handler 404s on the invisible task and never looks up the meeting. Create B’s own employee (`teamId: null`) and floating task, then PATCH that task with a non-null ISO `completedAt` and A’s `meetingId`. Expect 404; then GET B’s task and assert `completedMeetingId` is still null.

**Cleanup is two owners.** A still soft-deletes the original fixture employee then unique team. B must soft-delete the stamp-attack employee. Unique `iso-<run>-…` names on B’s person too. Never delete the All people system team.

---

## Phase 1: High-signal write proofs

### Overview

The existing two-session suite covers the three remaining writes. A’s fixture rows and B’s stamp-attack person are gone after `afterAll`.

### Changes Required:

#### 1. B-owned stamp fixture

**File**: `tests/helpers/fixtures.ts`

**Intent**: Give the stamp test a task B actually owns, without putting B’s person on the system team.

**Contract**: Helper creates a unique `iso-<run>-…` employee as B with `teamId: null` and a floating task (`POST /api/tasks` with that `employeeId` only). Returns ids needed for PATCH/GET/cleanup. Cleanup is `DELETE /api/employees/:id` as B (RPC cascades the task). Do not DELETE teams. Reuse `jsonAs` / `jsonInit` / unique-name style of `createIsolationFixtures`.

#### 2. Three write attacks + re-read

**File**: `tests/integration/cross-manager-isolation.test.ts`

**Intent**: Prove logged-in ≠ owns this row on the three writes research named; UI hide is still not the proof.

**Contract**: Same `beforeAll` A fixture as today. Also create/clean the B stamp fixture. As **B**, after A’s fixtures exist:

| B’s request                                                                 | Expect | Must also           |
| --------------------------------------------------------------------------- | ------ | ------------------- |
| `PATCH /api/tasks/:id` (A’s task, rename title)                             | 404    | no `task` object    |
| `PATCH /api/tasks/:id` (B’s task, `completedAt` + A’s `completedMeetingId`) | 404    |                     |
| `POST /api/meetings` `{ employeeId: A’s }`                                  | 404    | no `meeting` object |
| `POST /api/tasks` `{ employeeId: A’s, title }`                              | 404    | no `task` object    |

Then: GET B’s task is 200 and `completedMeetingId` is null (and title unchanged). As **A**: GET employee, meeting, `GET /api/meetings?employeeId=`, `GET /api/tasks?employeeId=` still show the original fixture ids and content (topics/notes/task title). Do not expect 403. Do not assert by copying handler error strings as the oracle. Do not add a second manager’s data as a “see both lists” happy path.

### Success Criteria:

#### Automated Verification:

- `npx vitest run tests/integration/cross-manager-isolation.test.ts` passes the new rows plus the existing matrix
- Full `npm test` still passes (unit + harness smoke + guest + cross-manager)
- `npm run lint` passes including `tests/`

#### Manual Verification:

- A’s dashboard after the suite does not show leftover `iso-*` people/teams from this run
- Signed in as B, people list does not show leftover `iso-*` stamp-attack person
- Spot-check: if B’s task GET returned A’s `meetingId` as `completedMeetingId`, the test would fail (oracle is “no A meeting on B’s task,” not “status is 404 because the handler says so”)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Cookbook stamp + create-on-foreign-person

### Overview

Later endpoints should copy the F1 attack shape, not only “PATCH the other manager’s id.”

### Changes Required:

#### 1. Isolation cookbook note

**File**: `context/foundation/test-plan.md`

**Intent**: §6.2 currently describes by-id read/write and list-by-foreign-employee. It does not mention create-on-foreign-parent or stamp-on-foreign-meeting.

**Contract**:

- **§6.2** — add that `POST /api/meetings` and floating `POST /api/tasks` with a foreign `employeeId` are **404** with no payload (not 200-empty). Add that a `completedMeetingId` (or similar FK stamp) check must PATCH **the caller’s own row** with the other manager’s id; PATCH on the foreign row 404s before the lookup and does not prove F1.
- **§6.6** — one short bullet for this change: B-owned person uses `teamId: null`; stamp body needs non-null `completedAt` plus the foreign meeting id.
- **§3 / §4 / §7** — do not change rollout status, stack pins, or exclusions. Do not mark CI as required.

Do not edit `AGENTS.md` unless the Testing paragraph no longer points at §6 (it already does). Do not edit `health-check.md` / `stack-assessment.md`.

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.2 names create-on-foreign-`employeeId` and own-row + foreign stamp
- `npm test` still passes after doc-only edits
- Prettier on the touched markdown (`npm run format` scoped to that file, or the repo format command already used for markdown)

#### Manual Verification:

- Reading §6.2 alone is enough to know why “PATCH A’s task with A’s meeting id” is the wrong F1 test and what to send instead

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- None. These proofs are HTTP against live gates. Do not unit-test `requireApiAuth` or the stamp `if` by mocking `getUser`.

### Integration Tests:

- Existing cross-manager matrix unchanged
- New: PATCH A’s task; stamp B’s task with A’s meeting; POST meeting and floating task on A’s `employeeId`; A + B re-read; two-owner cleanup

### Manual Testing Steps:

1. `npm test` with `.env` managers and `astro dev` reused or started by `globalSetup`.
2. Open `/dashboard` as A — no leftover `iso-*` people/teams.
3. Open people as B — no leftover stamp-attack `iso-*` person.
4. Optional: as B in the browser, open A’s employee URL — UI error is not the proof; the API tests are.

## Performance Considerations

One extra employee + task as B per run. Reuse `TEST_BASE_URL`. Do not add coverage gates.

## Migration Notes

No schema. Cloud data: A’s unique fixtures as today, plus B’s unique person (soft-deleted in `afterAll`). Existing Manager A/B data is not deleted. Isolation tests still share the cloud project with manual use.

## References

- Related research: `context/changes/testing-isolation-runner-bootstrap/research.md`
- Parent isolation change: `context/changes/testing-isolation-runner-bootstrap/plan.md`
- Test plan: `context/foundation/test-plan.md` §2, §6.2, §7
- Authz: `src/lib/api-auth.ts`, `src/pages/api/tasks/[id].ts`, `src/pages/api/meetings.ts`, `src/pages/api/tasks.ts`
- F1 history: `context/archive/2026-08-15-person-overview-task-followup/reviews/impl-review.md`
- Harness: `tests/helpers/session.ts`, `tests/helpers/fixtures.ts`, `tests/integration/cross-manager-isolation.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: High-signal write proofs

#### Automated

- [x] 1.1 `npx vitest run tests/integration/cross-manager-isolation.test.ts` passes the new rows plus the existing matrix — 004ac88
- [x] 1.2 Full `npm test` still passes (unit + harness smoke + guest + cross-manager) — 004ac88
- [x] 1.3 `npm run lint` passes including `tests/` — 004ac88

#### Manual

- [x] 1.4 A’s dashboard after the suite does not show leftover `iso-*` people/teams from this run — 004ac88
- [x] 1.5 Signed in as B, people list does not show leftover `iso-*` stamp-attack person — 004ac88
- [x] 1.6 Spot-check: if B’s task GET returned A’s `meetingId` as `completedMeetingId`, the test would fail (oracle is “no A meeting on B’s task,” not “status is 404 because the handler says so”) — 004ac88

### Phase 2: Cookbook stamp + create-on-foreign-person

#### Automated

- [x] 2.1 `context/foundation/test-plan.md` §6.2 names create-on-foreign-`employeeId` and own-row + foreign stamp
- [x] 2.2 `npm test` still passes after doc-only edits
- [x] 2.3 Prettier on the touched markdown (`npm run format` scoped to that file, or the repo format command already used for markdown)

#### Manual

- [x] 2.4 Reading §6.2 alone is enough to know why “PATCH A’s task with A’s meeting id” is the wrong F1 test and what to send instead
