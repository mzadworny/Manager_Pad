---
change_id: isolation-guest-by-id
title: Guest by-id isolation proofs
status: planned
created: 2026-09-07
updated: 2026-09-07
archived_at: null
---

## Notes

Follow-on to testing-isolation-runner-bootstrap for test-plan risk #2. Research (`context/archive/2026-08-31-testing-isolation-runner-bootstrap/research.md`) named guest by-id GET/PATCH/DELETE as untested: if one handler dropped `requireApiAuth`, status would be 404 not 401. Scope decided in /10x-plan: all 10 by-id methods + `GET /api/tasks?meetingId=` with synthetic UUID; add `GET /meetings` to the page redirect loop; cookbook §6.2/§6.6 note. No fixtures, no new authz.
