-- Wrap-up JSON (same empty TipTap doc as notes_json / EMPTY_NOTES_DOC)
-- '{"type":"doc","content":[{"type":"paragraph"}]}'
-- Constrain meetings.status to the two UI values.

alter table public.meetings
  add column observations_json jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  add column conclusions_json jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb;

alter table public.meetings
  add constraint meetings_status_check check (status in ('open', 'completed'));
