# Create Team and Employee — Implementation Plan

## Overview

Build the first product data layer and UI for Manager Pad: two Supabase tables (`teams`, `employees`) with manager-only RLS policies, JSON API endpoints for full CRUD, and a React-powered dashboard where the manager can create, edit, and soft-delete teams and employees via shadcn Dialog modals. This is roadmap slice S-01 — every later slice depends on these entities existing.

## Current State Analysis

- **Auth is working** — Supabase cookie-based SSR auth with protected `/dashboard` route
- **Dashboard is a placeholder** — shows user email and sign-out button only
- **No product tables** — zero migrations exist; `supabase/migrations/` is empty
- **No shared types** — `src/types.ts` does not exist
- **API pattern established** — auth routes use FormData + redirects; new product endpoints will use JSON
- **shadcn Dialog not installed** — needs `npx shadcn@latest add dialog` (plus `input`, `label`, `select` for forms)

### Key Discoveries:

- `src/lib/supabase.ts` exports `createClient(requestHeaders, cookies)` returning a typed Supabase client or `null`
- Middleware at `src/middleware.ts` protects routes in `PROTECTED_ROUTES` array — currently only `["/dashboard"]`
- All API routes live under `src/pages/api/` and export uppercase HTTP method handlers
- `cn()` utility in `src/lib/utils.ts` for Tailwind class merging

## Desired End State

The dashboard shows a list of the manager's teams. Each team card expands or navigates to show its employees. The manager can:

1. Create a team (name only) via a dialog
2. Create an employee (name, role) assigned to a team via a dialog
3. Edit team name or employee details via the same dialog pattern
4. Soft-delete teams or employees with a confirmation dialog
5. See a guided empty state ("Create your first team") when no teams exist

All data is scoped to the authenticated manager via RLS. Soft-deleted records are hidden from the UI but retained in the database (`deleted_at` timestamp).

## What We're NOT Doing

- Multi-team assignment for employees (deferred per FR-003 resolution)
- Employee email, avatar, or any fields beyond name + role
- Team descriptions, colors, or icons
- Drag-and-drop reordering of teams or employees
- Search or filtering (not needed at ~20 reportees scale)
- Meeting notes, tasks, or any S-02+ functionality
- Sidebar navigation (dashboard is the hub for now)

## Implementation Approach

Three phases, bottom-up: database schema first (so later phases have tables to work with), then API endpoints (so the UI has something to call), then UI components and dashboard rewrite. Each phase is independently testable.

## Phase 1: Database Schema & RLS

### Overview

Create the `teams` and `employees` tables with proper foreign keys, soft-delete support, and manager-only RLS policies. This is the data foundation for all product features.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/20260727000001_create_teams_and_employees.sql`

**Intent**: Create two tables owned by the authenticated manager, with soft-delete via `deleted_at` and row-level security ensuring each manager sees only their own data.

**Contract**:
- `teams` table: `id` (uuid PK, default `gen_random_uuid()`), `manager_id` (uuid FK → `auth.users(id)` ON DELETE CASCADE, NOT NULL), `name` (text NOT NULL), `created_at` (timestamptz default `now()`), `updated_at` (timestamptz default `now()`), `deleted_at` (timestamptz nullable)
- `employees` table: `id` (uuid PK, default `gen_random_uuid()`), `manager_id` (uuid FK → `auth.users(id)` ON DELETE CASCADE, NOT NULL), `team_id` (uuid FK → `teams(id)` ON DELETE CASCADE, NOT NULL), `name` (text NOT NULL), `role` (text NOT NULL DEFAULT `''`), `created_at` (timestamptz default `now()`), `updated_at` (timestamptz default `now()`), `deleted_at` (timestamptz nullable)
- RLS enabled on both tables with per-operation policies (SELECT, INSERT, UPDATE, DELETE) scoped to `auth.uid() = manager_id`
- SELECT policies additionally filter `deleted_at IS NULL` so soft-deleted rows are invisible by default
- Index on `teams(manager_id)` and `employees(team_id, manager_id)` for common query patterns

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase db reset`
- Tables and policies are visible: `npx supabase db dump --schema public` shows both tables with RLS enabled

#### Manual Verification:

- Using Supabase Studio, verify tables appear with correct columns and constraints
- Verify RLS policies exist for both tables

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: API Layer

### Overview

Create JSON API endpoints for teams and employees CRUD. All endpoints validate input with zod, use the Supabase client from `src/lib/supabase.ts`, and return JSON responses. Also create shared TypeScript types.

### Changes Required:

#### 1. Shared types

**File**: `src/types.ts`

**Intent**: Define TypeScript interfaces for teams and employees that are shared between API routes and UI components.

**Contract**: Export `Team` (id, managerId, name, createdAt, updatedAt) and `Employee` (id, managerId, teamId, name, role, createdAt, updatedAt) interfaces. Use camelCase field names (API endpoints transform from snake_case DB columns).

#### 2. Teams API

**File**: `src/pages/api/teams.ts`

**Intent**: Handle listing all teams and creating a new team for the authenticated manager.

**Contract**:
- `GET /api/teams` → returns `{ teams: Team[] }` (only non-deleted, scoped by RLS)
- `POST /api/teams` → accepts `{ name: string }`, validates with zod (name required, non-empty, trimmed), returns `{ team: Team }` with 201 status
- Both return 401 if not authenticated
- Export `const prerender = false`

#### 3. Single team API

**File**: `src/pages/api/teams/[id].ts`

**Intent**: Handle updating and soft-deleting a single team.

**Contract**:
- `PATCH /api/teams/:id` → accepts `{ name: string }`, validates with zod, returns `{ team: Team }`
- `DELETE /api/teams/:id` → sets `deleted_at = now()`, returns 204
- Both return 401 if not authenticated, 404 if team not found (RLS handles scoping)

#### 4. Employees API

**File**: `src/pages/api/employees.ts`

**Intent**: Handle listing employees (filtered by team) and creating a new employee.

**Contract**:
- `GET /api/employees?teamId=<uuid>` → returns `{ employees: Employee[] }` filtered by team, non-deleted
- `POST /api/employees` → accepts `{ name: string, role: string, teamId: string }`, validates with zod, returns `{ employee: Employee }` with 201
- Both return 401 if not authenticated

#### 5. Single employee API

**File**: `src/pages/api/employees/[id].ts`

**Intent**: Handle updating and soft-deleting a single employee.

**Contract**:
- `PATCH /api/employees/:id` → accepts partial `{ name?, role?, teamId? }`, validates with zod, returns `{ employee: Employee }`
- `DELETE /api/employees/:id` → sets `deleted_at = now()`, returns 204

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with no errors in new API files
- `npm run build` succeeds
- Type checking passes (no TypeScript errors)

#### Manual Verification:

- Using curl or Supabase Studio, create a team via POST, list via GET, update via PATCH, soft-delete via DELETE
- Verify employee CRUD works similarly with team assignment
- Verify 401 responses for unauthenticated requests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: UI Components & Dashboard

### Overview

Install missing shadcn components, build React islands for team and employee CRUD, and rewrite the dashboard page to serve as the teams/employees hub with guided empty states.

### Changes Required:

#### 1. Install shadcn components

**Intent**: Add the shadcn/ui components needed for dialogs and forms.

**Contract**: Run `npx shadcn@latest add dialog input label select` — this creates files in `src/components/ui/`.

#### 2. Team list component

**File**: `src/components/teams/TeamList.tsx`

**Intent**: React island that fetches and displays the manager's teams, with create/edit/delete actions. Shows a guided empty state when no teams exist.

**Contract**: Client-side component using `fetch` to call `/api/teams`. Renders team cards/rows. Each team shows its name, employee count, and action buttons (edit, delete). Includes a "Create team" button that opens the team dialog.

#### 3. Team dialog component

**File**: `src/components/teams/TeamDialog.tsx`

**Intent**: Reusable shadcn Dialog for creating and editing teams. Accepts an optional `team` prop (edit mode) or renders empty (create mode).

**Contract**: Form with a single `name` input. On submit, POSTs to `/api/teams` (create) or PATCHes `/api/teams/:id` (edit). Calls an `onSuccess` callback to trigger list refresh.

#### 4. Delete confirmation dialog

**File**: `src/components/shared/DeleteDialog.tsx`

**Intent**: Reusable confirmation dialog for soft-deleting any entity.

**Contract**: Accepts `title`, `description`, `onConfirm` props. Shows a destructive confirmation with cancel/delete buttons.

#### 5. Employee list component

**File**: `src/components/employees/EmployeeList.tsx`

**Intent**: React island that displays employees for a selected team, with create/edit/delete actions.

**Contract**: Accepts `teamId` prop. Fetches from `/api/employees?teamId=`. Renders employee rows with name, role, and action buttons.

#### 6. Employee dialog component

**File**: `src/components/employees/EmployeeDialog.tsx`

**Intent**: Reusable dialog for creating and editing employees within a team.

**Contract**: Form with `name` (required) and `role` (required) inputs. `teamId` passed as prop. On submit, POSTs to `/api/employees` (create) or PATCHes `/api/employees/:id` (edit).

#### 7. Dashboard page rewrite

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the placeholder dashboard with the teams/employees hub. Render `TeamList` as a React island with `client:load`.

**Contract**: Keep the existing layout and auth guard. Replace the placeholder card with `<TeamList client:load />`. The team list component handles navigation into individual teams to see employees.

#### 8. Protected routes update

**File**: `src/middleware.ts`

**Intent**: Ensure any new routes (if added) are protected. Currently `/dashboard` covers the hub, but verify no gaps.

**Contract**: No changes likely needed since the dashboard path is already protected and API routes check auth internally. Verify only.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` succeeds
- All new components type-check without errors

#### Manual Verification:

- Dashboard shows empty state with "Create your first team" CTA when no teams exist
- Creating a team via dialog adds it to the list
- Clicking a team shows its employees (initially empty with "Add employee" CTA)
- Creating an employee via dialog adds it to the team's list
- Editing a team or employee via dialog updates the displayed data
- Deleting a team or employee shows confirmation, then removes it from the list
- Refreshing the page retains all data
- Signing out and back in shows the same data
- A different user account sees no data from the first user

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- No test runner exists yet (per AGENTS.md). Defer unit tests until a testing decision is made.

### Integration Tests:

- Deferred — no test framework.

### Manual Testing Steps:

1. Start local Supabase (`npx supabase start`) and dev server (`npm run dev`)
2. Sign in, verify empty dashboard with CTA
3. Create a team, verify it appears
4. Create an employee in that team, verify it appears
5. Edit team name, verify update
6. Edit employee name/role, verify update
7. Delete employee, verify removal from list
8. Delete team, verify removal (and that its employees are also gone from view)
9. Create a second user account, verify data isolation

## Performance Considerations

- At ~20 reportees / few teams, no pagination needed
- RLS index on `manager_id` ensures fast queries
- All API calls are simple single-table operations — no complex joins

## Migration Notes

- First migration — no existing data to migrate
- Soft delete (`deleted_at`) chosen over hard delete to prevent accidental data loss; later slices may add "restore" functionality
- If multi-team assignment is needed later, the `employees.team_id` FK can be replaced with a junction table without losing existing data

## References

- Roadmap slice: S-01 in `context/foundation/roadmap.md`
- PRD requirements: FR-001, FR-002, FR-003 in `context/foundation/prd.md`
- Supabase client: `src/lib/supabase.ts`
- Existing API pattern: `src/pages/api/auth/signin.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Schema & RLS

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — 853077e
- [x] 1.2 Tables and policies visible in schema dump — 853077e

#### Manual

- [x] 1.3 Verify tables and constraints in Supabase Studio — 853077e
- [x] 1.4 Verify RLS policies exist for both tables — 853077e

### Phase 2: API Layer

#### Automated

- [ ] 2.1 Lint passes on new API files
- [ ] 2.2 Build succeeds
- [ ] 2.3 Type checking passes

#### Manual

- [ ] 2.4 Teams CRUD works via curl
- [ ] 2.5 Employees CRUD works via curl
- [ ] 2.6 Unauthenticated requests return 401

### Phase 3: UI Components & Dashboard

#### Automated

- [ ] 3.1 Lint passes
- [ ] 3.2 Build succeeds
- [ ] 3.3 All components type-check

#### Manual

- [ ] 3.4 Empty state shows CTA when no teams exist
- [ ] 3.5 Team CRUD works via UI dialogs
- [ ] 3.6 Employee CRUD works via UI dialogs
- [ ] 3.7 Data persists across page refreshes
- [ ] 3.8 Data isolation between different user accounts
