-- Meetings and tasks with manager RLS, soft-delete, and cascade RPCs

-- Empty TipTap doc (must match src/types.ts EMPTY_NOTES_DOC)
-- '{"type":"doc","content":[{"type":"paragraph"}]}'

-- Meetings table
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  meeting_date date not null,
  topics text not null default '',
  notes_json jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tasks table (employee_id denormalized from meeting for S-04 person overview)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  title text not null,
  planned_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Indexes
create index idx_meetings_manager_employee on public.meetings(manager_id, employee_id);
create index idx_tasks_manager_employee on public.tasks(manager_id, employee_id);
create index idx_tasks_meeting_id on public.tasks(meeting_id);

-- Enable RLS
alter table public.meetings enable row level security;
alter table public.tasks enable row level security;

-- Meetings RLS policies
create policy "meetings_select" on public.meetings
  for select to authenticated
  using (auth.uid() = manager_id and deleted_at is null);

create policy "meetings_insert" on public.meetings
  for insert to authenticated
  with check (auth.uid() = manager_id);

create policy "meetings_update" on public.meetings
  for update to authenticated
  using (auth.uid() = manager_id)
  with check (auth.uid() = manager_id);

create policy "meetings_delete" on public.meetings
  for delete to authenticated
  using (auth.uid() = manager_id);

-- Tasks RLS policies
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (auth.uid() = manager_id and deleted_at is null);

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (auth.uid() = manager_id);

create policy "tasks_update" on public.tasks
  for update to authenticated
  using (auth.uid() = manager_id)
  with check (auth.uid() = manager_id);

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (auth.uid() = manager_id);

-- Auto-update updated_at triggers (reuses public.set_updated_at)
create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Soft-delete a single task
create or replace function public.soft_delete_task(task_id_param uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
begin
  update public.tasks
  set deleted_at = now()
  where id = task_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

-- Soft-delete a meeting and its tasks
create or replace function public.soft_delete_meeting(meeting_id_param uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
begin
  update public.tasks
  set deleted_at = now()
  where meeting_id = meeting_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  update public.meetings
  set deleted_at = now()
  where id = meeting_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

-- Replace soft_delete_employee: cascade tasks → meetings → employee
-- Signature unchanged: employee_id_param uuid → boolean
create or replace function public.soft_delete_employee(employee_id_param uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
begin
  update public.tasks
  set deleted_at = now()
  where employee_id = employee_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  update public.meetings
  set deleted_at = now()
  where employee_id = employee_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  update public.employees
  set deleted_at = now()
  where id = employee_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

grant execute on function public.soft_delete_task(uuid) to authenticated;
grant execute on function public.soft_delete_meeting(uuid) to authenticated;
grant execute on function public.soft_delete_employee(uuid) to authenticated;
