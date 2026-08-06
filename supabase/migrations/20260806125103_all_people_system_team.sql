-- All people system team: is_system flag, nullable team_id, soft-delete clears filters

-- 1. System team flag
alter table public.teams
  add column is_system boolean not null default false;

-- One system team per manager (including soft-deleted rows, so a second cannot be created)
create unique index idx_teams_one_system_per_manager
  on public.teams (manager_id)
  where is_system = true;

-- 2. Make employees.team_id nullable with ON DELETE SET NULL
alter table public.employees
  alter column team_id drop not null;

do $$
declare
  fk_name text;
begin
  select tc.constraint_name
  into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'employees'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'team_id'
  limit 1;

  if fk_name is not null then
    execute format('alter table public.employees drop constraint %I', fk_name);
  end if;
end $$;

alter table public.employees
  add constraint employees_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;

-- 3. Clear legacy orphans pointing at soft-deleted teams
update public.employees
set team_id = null
where team_id in (
  select id from public.teams where deleted_at is not null
);

-- 4. Backfill "All people" for every auth user missing a system team
insert into public.teams (manager_id, name, is_system)
select u.id, 'All people', true
from auth.users u
where not exists (
  select 1
  from public.teams t
  where t.manager_id = u.id
    and t.is_system = true
);

-- 5. Replace soft_delete_team: refuse system teams; clear filters then soft-delete
create or replace function public.soft_delete_team(team_id_param uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
  target_is_system boolean;
begin
  select is_system
  into target_is_system
  from public.teams
  where id = team_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  if not found then
    return false;
  end if;

  if target_is_system then
    return false;
  end if;

  update public.employees
  set team_id = null
  where team_id = team_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  update public.teams
  set deleted_at = now()
  where id = team_id_param
    and manager_id = auth.uid()
    and deleted_at is null
    and is_system = false;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

grant execute on function public.soft_delete_team(uuid) to authenticated;
