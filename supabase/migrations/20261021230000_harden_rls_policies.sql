drop policy if exists "Profiles are readable by owner or admin" on public.profiles;
drop policy if exists "Profiles are editable by owner or admin" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Profiles are readable by owner or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "Profiles are editable by owner" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (gender, accent_color, preferred_macro_categories, preferred_equipment, logo_url)
  on table public.profiles to authenticated;
grant select, update on table public.profiles to service_role;

drop policy if exists "Entitlements are readable by owner or admin" on public.user_entitlements;
drop policy if exists "Admins can manage entitlements" on public.user_entitlements;
create policy "Entitlements are readable by owner or admin" on public.user_entitlements
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins can insert entitlements" on public.user_entitlements
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update entitlements" on public.user_entitlements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on table public.user_entitlements from public, anon, authenticated;
grant select on table public.user_entitlements to authenticated;
grant select, insert, update on table public.user_entitlements to service_role;
grant insert (user_id, plan, blocked, mentor_query_count, mentor_query_month, analysis_count, analysis_month)
  on public.user_entitlements to authenticated;
grant update (plan, blocked, mentor_query_count, mentor_query_month, analysis_count, analysis_month)
  on public.user_entitlements to authenticated;

drop policy if exists "Exercises are readable by authenticated users" on public.exercises;
drop policy if exists "Admins can manage exercises" on public.exercises;
create policy "Exercises are readable by authenticated users" on public.exercises
  for select to authenticated using (true);
create policy "Admins can manage exercises" on public.exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on table public.exercises from public, anon, authenticated;
grant select on table public.exercises to authenticated;

drop policy if exists "Athletes belong to their owner" on public.athletes;
create policy "Athletes are readable by owner or admin" on public.athletes
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Owners and admins can create athletes" on public.athletes
  for insert to authenticated with check (user_id = (select auth.uid()) or public.is_admin());
create policy "Owners and admins can update athletes" on public.athletes
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
create policy "Owners and admins can delete athletes" on public.athletes
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_admin());

revoke all on table public.athletes from public, anon, authenticated;
grant select, delete on table public.athletes to authenticated;
grant insert (name, gender, birth_date, email, notes) on public.athletes to authenticated;
grant update (name, gender, birth_date, email, notes, updated_at) on public.athletes to authenticated;

drop policy if exists "Reports belong to their owner" on public.analysis_reports;
create policy "Reports are readable by owner or admin" on public.analysis_reports
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Owners and admins can update reports" on public.analysis_reports
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (
    (user_id = (select auth.uid()) or public.is_admin())
    and (
      athlete_id is null
      or public.is_admin()
      or exists (
        select 1 from public.athletes a
        where a.id = analysis_reports.athlete_id and a.user_id = (select auth.uid())
      )
    )
  );
create policy "Owners and admins can delete reports" on public.analysis_reports
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_admin());

revoke all on table public.analysis_reports from public, anon, authenticated;
grant select, delete on table public.analysis_reports to authenticated;
grant update (video_uri, selected_corrective_exercises, corrective_selection_saved)
  on public.analysis_reports to authenticated;
grant select, insert on table public.analysis_reports to service_role;

drop policy if exists "Conversations belong to their owner" on public.mentor_conversations;
create policy "Conversations are readable by owner or admin" on public.mentor_conversations
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Owners and admins can create conversations" on public.mentor_conversations
  for insert to authenticated with check (user_id = (select auth.uid()) or public.is_admin());
create policy "Owners and admins can update conversations" on public.mentor_conversations
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
create policy "Owners and admins can delete conversations" on public.mentor_conversations
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_admin());

revoke all on table public.mentor_conversations from public, anon, authenticated;
grant select, delete on table public.mentor_conversations to authenticated;
grant insert (user_id, title) on public.mentor_conversations to authenticated;
grant update (title, updated_at) on public.mentor_conversations to authenticated;

drop policy if exists "Messages belong to their conversation owner" on public.mentor_messages;
create policy "Messages are readable by conversation owner or admin" on public.mentor_messages
  for select to authenticated using (
    exists (
      select 1 from public.mentor_conversations c
      where c.id = conversation_id and (c.user_id = (select auth.uid()) or public.is_admin())
    )
  );

revoke all on table public.mentor_messages from public, anon, authenticated;
grant select on table public.mentor_messages to authenticated;
grant select, insert, delete on table public.mentor_messages to service_role;

drop policy if exists "Users manage their own analysis media" on storage.objects;
create policy "Users manage their own analysis media" on storage.objects
  for all to authenticated
  using (bucket_id = 'analysis-media' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'analysis-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Users manage their own public assets" on storage.objects;
create policy "Users manage their own public assets" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'public-assets' and owner_id = (select auth.uid())::text);

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'public-assets';

revoke all on function public.release_monthly_quota(text) from public, anon, authenticated, service_role;

create or replace function public.release_monthly_quota_for_user(p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month text := to_char(now() at time zone 'Europe/Rome', 'YYYY-MM');
begin
  if coalesce(auth.role(), '') <> 'service_role'
    or p_user_id is null
    or p_kind not in ('analysis', 'mentor') then
    raise exception 'Unauthorized quota release';
  end if;

  if p_kind = 'analysis' then
    update public.user_entitlements
    set analysis_count = greatest(analysis_count - 1, 0), updated_at = now()
    where user_id = p_user_id and analysis_month = current_month;
  else
    update public.user_entitlements
    set mentor_query_count = greatest(mentor_query_count - 1, 0), updated_at = now()
    where user_id = p_user_id and mentor_query_month = current_month;
    update public.profiles
    set mentor_query_count = greatest(mentor_query_count - 1, 0), updated_at = now()
    where id = p_user_id and mentor_query_month = current_month;
  end if;
end;
$$;

revoke all on function public.release_monthly_quota_for_user(uuid, text) from public, anon, authenticated;
grant execute on function public.release_monthly_quota_for_user(uuid, text) to service_role;
