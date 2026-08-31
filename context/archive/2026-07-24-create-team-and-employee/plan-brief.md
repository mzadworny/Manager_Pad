# Create Team and Employee — Plan Brief

> Full plan: `context/changes/create-team-and-employee/plan.md`

## What & Why

Build the first product data layer and CRUD UI for Manager Pad. Managers need to create teams and employee records before they can do anything else (meetings, notes, tasks all depend on employees existing). This is roadmap slice S-01 — the foundation every later slice builds on.

## Starting Point

The codebase is an Astro 6 starter with Supabase cookie-based auth working. The dashboard is a placeholder showing only the user's email. No product tables exist — zero migrations, no shared types file. shadcn/ui is partially installed (only Button component).

## Desired End State

The dashboard is a functional teams/employees hub. A manager can create teams (name only), add employees to teams (name + role), edit and soft-delete both. Data is scoped to the authenticated manager via RLS. An empty state guides first-time users with a "Create your first team" CTA.

## Key Decisions Made

| Decision        | Choice                      | Why (1 sentence)                                                           |
| --------------- | --------------------------- | -------------------------------------------------------------------------- |
| Team fields     | Name only                   | Keep it minimal — no description, color, or icon needed for v1.            |
| Employee fields | Name + role + team          | Matches FR-003; email and avatar deferred.                                 |
| Navigation      | Dashboard becomes teams hub | Avoids premature sidebar/routing; single page is enough for ~20 reportees. |
| CRUD pattern    | shadcn Dialog modals        | Keeps the user in context; reusable for create and edit.                   |
| Empty state     | Guided CTA                  | "Create your first team" reduces friction for first-time users.            |
| Deletion        | Soft delete (deleted_at)    | Prevents accidental data loss; hard delete is irreversible.                |
| Editing         | Yes, via same modal         | Reusing the create dialog for edit reduces component count.                |
| Validation      | Required fields + non-empty | Client + server; no uniqueness constraints beyond what's needed.           |

## Scope

**In scope:**

- `teams` and `employees` tables with RLS
- JSON API endpoints for full CRUD (list, create, update, soft-delete)
- React islands for team list, employee list, create/edit/delete dialogs
- Dashboard rewrite as teams/employees hub
- Guided empty states

**Out of scope:**

- Multi-team assignment, employee email/avatar
- Search, filtering, drag-and-drop
- Meeting notes, tasks, or any S-02+ features
- Sidebar navigation

## Architecture / Approach

Bottom-up vertical slice: Supabase migration → API endpoints (JSON, zod-validated) → React islands on the Astro dashboard page. Two tables (`teams`, `employees`) with `manager_id` FK to `auth.users` and `deleted_at` for soft delete. RLS policies scope all operations to the authenticated manager.

## Phases at a Glance

| Phase                        | What it delivers                                        | Key risk                                                       |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Database Schema & RLS     | Two tables with indexes and manager-scoped RLS policies | First migration — sets the data model for all future slices    |
| 2. API Layer                 | JSON CRUD endpoints + shared TypeScript types           | New API pattern (JSON vs existing FormData) must be consistent |
| 3. UI Components & Dashboard | React islands, dialogs, empty states, dashboard rewrite | Largest phase — most files touched, most surface area for bugs |

**Prerequisites:** Local Supabase running (`npx supabase start`), auth working
**Estimated effort:** ~2-3 sessions across 3 phases

## Open Risks & Assumptions

- First migration sets the table structure — changing it later requires a new migration
- Soft delete adds a `deleted_at` filter to every query; acceptable complexity for data safety
- No test runner exists — manual testing only until a testing decision is made

## Success Criteria (Summary)

- Manager can create, edit, and delete teams and employees from the dashboard
- Data is private to each manager (RLS-enforced)
- Empty state guides the manager to create their first team
