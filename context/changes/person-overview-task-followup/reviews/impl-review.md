<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Person Overview and Task Follow-up

- **Plan**: context/changes/person-overview-task-followup/plan.md
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-08-29
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 1 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — PATCH stamp writes completedMeetingId without a meeting lookup

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/tasks/[id].ts:59-67
- **Detail**: PATCH honors `completedMeetingId` whenever `completedAt` is a timestamp, and writes it straight onto the task. RLS only proves the _task_ belongs to the caller. The FK is `references meetings(id)` with no employee/manager check, so any existing meeting UUID is accepted — including another manager’s meeting or a meeting for a different employee. A nonexistent UUID fails the FK and returns 500 + `error.message`, unlike POST/GET which load the meeting first and 404. Honest UI always sends the current meeting id; the gap is a crafted PATCH. Cross-manager stamps also will not be cleared by the other manager’s `soft_delete_meeting` (`manager_id = auth.uid()`).
- **Fix A ⭐ Recommended**: When `completedAt` is non-null and `completedMeetingId` is present, select that meeting under RLS (`id, employee_id`). 404 if missing; 400 if `employee_id` ≠ the task’s `employee_id`; then write the stamp. Invalid ids become 404 instead of 500.
  - Strength: Matches POST `/api/tasks` and GET `?meetingId=` which already load the meeting under RLS before trusting the id.
  - Tradeoff: Extra round-trip on complete-from-meeting only (one lookup per PATCH that sends a stamp).
  - Confidence: HIGH — identical load-then-write pattern is already in `src/pages/api/tasks.ts`.
  - Blind spot: Have not verified whether a DB check constraint on employee match would be preferable as a second line of defense.
- **Fix B**: Add a DB check/trigger that `completed_meeting_id`’s meeting `employee_id` equals the task’s `employee_id` (and keep the API lookup for 404 vs 500).
  - Strength: Enforces the invariant even if a future client or RPC bypasses the PATCH handler.
  - Tradeoff: New migration; error shape is still a Postgres 500 unless the API also maps it.
  - Confidence: MEDIUM — worth it if stamps are treated as a durable cross-row invariant; overkill if only the honest UI writes them.
  - Blind spot: Need to confirm trigger vs CHECK across tables (CHECK cannot see `meetings.employee_id`).
- **Decision**: FIXED via Fix A

### F2 — Delete-meeting copy still says all tasks are removed

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/meetings/MeetingCapture.tsx:303
- **Detail**: Cascade is correct: origin tasks (`meeting_id = param`) are soft-deleted; floating tasks stamped to that meeting keep their rows and have `completed_meeting_id` cleared. The confirm dialog still says “This will soft-delete the meeting and its tasks,” which is true for origin tasks and misleading for person-level work closed in that meeting.
- **Fix**: Update the description to say origin tasks are removed and person-level tasks stay on the overview.
- **Decision**: FIXED
