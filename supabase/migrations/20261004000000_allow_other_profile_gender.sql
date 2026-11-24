alter table public.profiles
  drop constraint if exists profiles_gender_check,
  add constraint profiles_gender_check check (gender in ('maschio', 'femmina', 'altro'));

alter table public.analysis_reports
  drop constraint if exists analysis_reports_gender_check,
  add constraint analysis_reports_gender_check check (gender in ('maschio', 'femmina', 'altro'));