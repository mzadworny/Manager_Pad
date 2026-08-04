-- Provide RLS-safe soft delete operations for teams and employees.
-- These functions enforce manager ownership using auth.uid() and return
-- whether a row was updated.

create or replace function public.soft_delete_team(team_id_param uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
begin
  update public.teams
  set deleted_at = now()
  where id = team_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

create or replace function public.soft_delete_employee(employee_id_param uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
begin
  update public.employees
  set deleted_at = now()
  where id = employee_id_param
    and manager_id = auth.uid()
    and deleted_at is null;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

grant execute on function public.soft_delete_team(uuid) to authenticated;
grant execute on function public.soft_delete_employee(uuid) to authenticated;
