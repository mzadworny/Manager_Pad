-- Person-level tasks (nullable origin) and close-in-meeting stamps.
-- Existing completed origin tasks backfill completed_meeting_id = meeting_id.

alter table public.tasks
  alter column meeting_id drop not null;

alter table public.tasks
  add column completed_meeting_id uuid references public.meetings(id) on delete restrict;

create index idx_tasks_completed_meeting_id on public.tasks(completed_meeting_id);

update public.tasks
set completed_meeting_id = meeting_id
where completed_at is not null
  and deleted_at is null;

-- Soft-delete a meeting: cascade origin tasks, clear stamps on remaining rows, then the meeting.
-- Signature unchanged: meeting_id_param uuid → boolean
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

  update public.tasks
  set completed_meeting_id = null
  where completed_meeting_id = meeting_id_param
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

grant execute on function public.soft_delete_meeting(uuid) to authenticated;
