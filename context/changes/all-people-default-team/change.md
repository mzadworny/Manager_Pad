---
change_id: all-people-default-team
title: Default unremovable All people team
status: new
created: 2026-08-06
updated: 2026-08-06
archived_at: null
linear_issue: null
---

## Notes

Instead of cascading soft-delete when a team is removed, keep every manager's employees under a built-in team named "All people" that exists from the start and cannot be removed (or renamed). Soft-deleting a normal team should reassign its employees to "All people", then soft-delete that team. Seed "All people" for each manager (on signup / first dashboard load / migration backfill for existing users).
