---
change_id: isolation-high-signal-writes
title: High-signal cross-manager write proofs
status: archived
created: 2026-09-07
updated: 2026-09-07
archived_at: 2026-09-07T19:00:06Z
---

## Notes

Follow-on to testing-isolation-runner-bootstrap. Research (`context/archive/2026-08-31-testing-isolation-runner-bootstrap/research.md`) grounded risk #1: remaining untested writes are PATCH /api/tasks/:id (F1 stamp), POST /api/meetings on a foreign employeeId, and POST /api/tasks with a foreign employeeId only. Scope decided in /10x-plan: those three HTTP proofs only; no new RLS or FK constraints.
