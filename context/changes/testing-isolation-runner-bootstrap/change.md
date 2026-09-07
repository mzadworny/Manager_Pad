---
change_id: testing-isolation-runner-bootstrap
title: Isolation + runner bootstrap
status: implemented
created: 2026-08-31
updated: 2026-09-07
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Isolation + runner bootstrap".
Risks covered: #1 (logged-in manager A can read or write manager B’s people, meetings, notes, or tasks), #2 (a guest / unauthenticated request can read any manager’s data). Test types planned: unit + API integration.
Risk response intent: #1 prove Manager B’s ids never return A’s notes/tasks/people on read and write — challenge “logged in” ≠ owns this row and UI hide ≠ API deny; #2 prove unauthenticated GET/POST to product APIs and protected pages is 401/redirect with empty notes/tasks — challenge that middleware on pages implies APIs are gated.
After creating the folder, follow the downstream continuation rule.
