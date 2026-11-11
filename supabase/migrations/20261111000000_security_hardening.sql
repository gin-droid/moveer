create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from public, anon, authenticated;

create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  fixed_window timestamptz;
  current_hits integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    or p_key is null
    or length(p_key) < 1
    or length(p_key) > 300
    or p_max < 1
    or p_window_seconds < 1 then
    raise exception 'Unauthorized rate limit request';
  end if;

  fixed_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as limits (key, window_start, hits)
  values (p_key, fixed_window, 1)
  on conflict (key, window_start)
  do update set hits = limits.hits + 1
  returning hits into current_hits;

  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '31 days';
  end if;

  return current_hits <= p_max;
end;
$$;

create or replace function public.list_user_storage_objects(p_user_id uuid)
returns table(bucket_id text, name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_user_id is null then
    raise exception 'Unauthorized storage listing request';
  end if;

  return query
    select objects.bucket_id, objects.name
    from storage.objects as objects
    where objects.owner_id = p_user_id::text
      and objects.bucket_id in ('analysis-media', 'public-assets');
end;
$$;

create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_user_id is null then
    raise exception 'Unauthorized session revocation request';
  end if;

  delete from auth.sessions where user_id = p_user_id;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.list_user_storage_objects(uuid) from public, anon, authenticated;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.list_user_storage_objects(uuid) to service_role;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'
]
where id = 'analysis-media';

drop policy if exists "Users manage their own analysis media" on storage.objects;
create policy "Users read own analysis media" on storage.objects
  for select to authenticated
  using (bucket_id = 'analysis-media' and owner_id = (select auth.uid())::text);
create policy "Users upload prefixed analysis media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'analysis-media'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users update own analysis media" on storage.objects
  for update to authenticated
  using (bucket_id = 'analysis-media' and owner_id = (select auth.uid())::text)
  with check (
    bucket_id = 'analysis-media'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users delete own analysis media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'analysis-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Users manage their own public assets" on storage.objects;
create policy "Users upload prefixed public assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users manage own public assets" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and owner_id = (select auth.uid())::text)
  with check (
    bucket_id = 'public-assets'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter table public.profiles
  add constraint profiles_accent_color_hsl_check
  check (accent_color is null or accent_color ~ '^[0-9]{1,3} [0-9]{1,3}% [0-9]{1,3}%$') not valid,
  add constraint profiles_logo_url_https_check
  check (logo_url is null or logo_url = '' or (length(logo_url) <= 1024 and logo_url like 'https://%')) not valid;

alter table public.athletes
  add constraint athletes_name_length_check
  check (char_length(btrim(name)) between 1 and 120) not valid,
  add constraint athletes_email_format_check
  check (email is null or email = '' or (
    length(email) <= 320 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )) not valid,
  add constraint athletes_notes_length_check
  check (notes is null or length(notes) <= 5000) not valid;

alter table public.mentor_conversations
  add constraint mentor_conversations_title_length_check
  check (title is null or length(title) <= 200) not valid;

alter table public.analysis_reports
  add constraint analysis_reports_video_uri_check
  check (video_uri is null or video_uri = '' or (
    length(video_uri) <= 300
    and left(video_uri, 1) <> '/'
    and position('..' in video_uri) = 0
    and position('://' in video_uri) = 0
  )) not valid;

create index if not exists mentor_conversations_user_updated_idx
  on public.mentor_conversations (user_id, updated_at desc);