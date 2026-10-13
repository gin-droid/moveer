alter table public.analysis_reports
  add column if not exists corrective_selection_saved boolean not null default false;

update public.analysis_reports
set corrective_selection_saved = true
where jsonb_typeof(selected_corrective_exercises) = 'array'
  and jsonb_array_length(selected_corrective_exercises) > 0;