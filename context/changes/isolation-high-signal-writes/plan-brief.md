# High-signal cross-manager write proofs — Plan Brief

> Full plan: `context/changes/isolation-high-signal-writes/plan.md`
> Research: `context/changes/testing-isolation-runner-bootstrap/research.md`

## What & Why

The Phase 1 isolation suite proves a representative matrix. Research found three untested writes that can still hide a leak: PATCH on A’s task, F1-style stamp of A’s meeting onto B’s task, and create meeting/task on A’s person. This change occupies those holes with HTTP proofs. It does not add new authz.

## Starting Point

Vitest, two cloud cookie sessions, `iso-*` fixtures, and cookbook §6.2 already exist. RLS `auth.uid() = manager_id` plus parent `maybeSingle` → 404 is the gate. The API stamp lookup landed after F1; no isolation test sends `completedMeetingId`.

## Desired End State

`npm test` fails if B can rename A’s task, stamp A’s meeting on B’s own task, or POST a meeting/floating task with A’s `employeeId`. A’s fixture content is unchanged. Cookbook §6.2 tells the next author to attack **their own row** with a foreign stamp id. CI still does not run tests.

## Key Decisions Made

| Decision      | Choice                             | Why (1 sentence)                                                         | Source          |
| ------------- | ---------------------------------- | ------------------------------------------------------------------------ | --------------- |
| Coverage      | High-signal trio only              | Cost × signal: F1 plus both create-on-foreign-person paths               | Plan            |
| Boundary      | Product API tests only             | Frame: proofs not new authz; §7 rejects pgTAP; F1 Fix B already declined | Research / Plan |
| Stamp shape   | B’s own task + A’s meeting id      | PATCH A’s task 404s before the meeting lookup and does not prove F1      | Research        |
| Suite layout  | Extend existing cross-manager file | One harness, one A fixture, cookbook already points here                 | Plan            |
| Change folder | New `isolation-high-signal-writes` | Parent change is `implemented`; do not overwrite its plan                | Plan            |

## Scope

**In scope:**

- B-owned stamp fixture (`teamId: null` person + floating task)
- Four B requests + A/B re-read + two-owner cleanup
- Cookbook §6.2 / §6.6 note

**Out of scope:**

- DB FK/trigger work, full leftover matrix, guest by-id, CI, Playwright, new RLS

## Architecture / Approach

Same as Phase 1: `fetch` `TEST_BASE_URL` with two cookie jars. Oracles are 404 + empty product keys + unchanged re-read. Extra fixture is B’s person on All people (`teamId: null`), never a second system team.

## Phases at a Glance

| Phase                       | What it delivers                                      | Key risk                                                             |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| 1. High-signal write proofs | Trio + stamp fixture + cleanup                        | Stamp test PATCHes A’s task and misses F1; leftover B `iso-*` person |
| 2. Cookbook note            | §6.2 names create-on-foreign-person and own-row stamp | Cookbook that restates handler strings as the oracle                 |

**Prerequisites:** Existing isolation harness (two documented managers, `globalSetup` or `TEST_BASE_URL`).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- B creating people with `teamId: null` remains allowed (All people). If that POST starts returning 400, the stamp fixture needs a B-owned unique team.
- Isolation tests still write (then delete) rows on the shared cloud project.

## Success Criteria (Summary)

- B cannot write through A’s task, meeting, or person ids on the three paths above
- B’s own task cannot carry A’s `completedMeetingId`
- A later author can copy the stamp attack from §6.2 without re-reading research
