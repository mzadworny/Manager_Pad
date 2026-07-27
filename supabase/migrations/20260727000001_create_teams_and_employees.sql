-- Create teams and employees tables with RLS for manager-only access

-- Teams table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Employees table
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Indexes
create index idx_teams_manager_id on public.teams(manager_id);
create index idx_employees_team_manager on public.employees(team_id, manager_id);

-- Enable RLS
alter table public.teams enable row level security;
alter table public.employees enable row level security;

-- Teams RLS policies
create policy "teams_select" on public.teams
  for select to authenticated
  using (auth.uid() = manager_id and deleted_at is null);

create policy "teams_insert" on public.teams
  for insert to authenticated
  with check (auth.uid() = manager_id);

create policy "teams_update" on public.teams
  for update to authenticated
  using (auth.uid() = manager_id)
  with check (auth.uid() = manager_id);

create policy "teams_delete" on public.teams
  for delete to authenticated
  using (auth.uid() = manager_id);

-- Employees RLS policies
create policy "employees_select" on public.employees
  for select to authenticated
  using (auth.uid() = manager_id and deleted_at is null);

create policy "employees_insert" on public.employees
  for insert to authenticated
  with check (auth.uid() = manager_id);

create policy "employees_update" on public.employees
  for update to authenticated
  using (auth.uid() = manager_id)
  with check (auth.uid() = manager_id);

create policy "employees_delete" on public.employees
  for delete to authenticated
  using (auth.uid() = manager_id);

-- Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create trigger employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();
