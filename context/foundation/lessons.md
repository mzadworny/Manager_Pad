# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Prefer UI-first phases for manual testing

- **Context**: Feature planning and implementation phasing (`/10x-plan`, `/10x-implement`) for product UI work
- **Problem**: Schema/API-first slices delay the first clickable flow; feedback on layout and capture UX arrives late
- **Rule**: Prefer phases that ship interactive UI shells with local/mock state first, then add schema, API, and persistence underneath — unless the change is purely backend/infra with no user-facing surface
- **Applies to**: plan, plan-review, implement
