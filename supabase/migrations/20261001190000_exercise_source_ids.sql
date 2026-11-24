alter table public.exercises
  add column if not exists source_base44_id text,
  add column if not exists is_sample boolean not null default false;

create unique index if not exists exercises_source_base44_id_uidx
  on public.exercises (source_base44_id)
  where source_base44_id is not null;