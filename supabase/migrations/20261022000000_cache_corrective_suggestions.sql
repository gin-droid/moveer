-- Corrective suggestions are generated once per report and reused, so a saved
-- selection always refers to the same list of exercises.
alter table public.analysis_reports
  add column if not exists corrective_suggestions jsonb;

grant update (corrective_suggestions) on table public.analysis_reports to service_role;
