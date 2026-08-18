---
change_id: person-overview-task-followup
title: Person overview and task follow-up
status: implementing
created: 2026-08-15
updated: 2026-08-15
archived_at: null
linear_issue: MAC-8
---

## Notes

Roadmap S-04 / US-01 / FR-008–010. UI-first phasing (shells → schema/API → persist) per `AGENTS.md` / `lessons.md`.

Product decisions from planning:

- Three-column person overview: meeting selector | read-only meeting fields | all person tasks.
- Overview notes are read-only; live capture/finalize stays on `/meetings/[id]`.
- Tasks added from the overview are person-level (no origin meeting). They can be closed in a later meeting (`completed_meeting_id`). Overview complete sets `completed_at` only.
- Meeting side panel shows all open person-tasks plus tasks closed in that meeting.
- Newest meeting selected by default; meeting fields shown as small expandable boxes.
