create or replace function public.consume_monthly_quota(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_month text := to_char(now() at time zone 'Europe/Rome', 'YYYY-MM');
  entitlement public.user_entitlements%rowtype;
  current_plan text;
  current_count integer;
  current_limit integer;
  count_month text;
begin
  if current_user_id is null or p_kind not in ('analysis', 'mentor') then
    raise exception 'Unauthorized quota request';
  end if;

  insert into public.user_entitlements (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select * into entitlement
  from public.user_entitlements
  where user_id = current_user_id
  for update;

  current_plan := coalesce(entitlement.plan, 'freemium');
  if entitlement.blocked then
    return jsonb_build_object('allowed', false, 'blocked', true, 'used', 0, 'limit', 0, 'plan', current_plan);
  end if;

  if p_kind = 'analysis' then
    current_count := case when entitlement.analysis_month = current_month then entitlement.analysis_count else 0 end;
    count_month := entitlement.analysis_month;
    current_limit := case current_plan when 'coach' then 100 when 'pro' then 30 else 3 end;
  else
    current_count := case when entitlement.mentor_query_month = current_month then entitlement.mentor_query_count else 0 end;
    count_month := entitlement.mentor_query_month;
    current_limit := case current_plan when 'coach' then 200 when 'pro' then 50 else 5 end;
  end if;

  if current_count >= current_limit then
    return jsonb_build_object('allowed', false, 'blocked', false, 'used', current_count, 'limit', current_limit, 'plan', current_plan);
  end if;

  current_count := current_count + 1;
  if p_kind = 'analysis' then
    update public.user_entitlements
    set analysis_count = current_count, analysis_month = current_month, updated_at = now()
    where user_id = current_user_id;
  else
    update public.user_entitlements
    set mentor_query_count = current_count, mentor_query_month = current_month, updated_at = now()
    where user_id = current_user_id;
    update public.profiles
    set mentor_query_count = current_count, mentor_query_month = current_month, updated_at = now()
    where id = current_user_id;
  end if;

  return jsonb_build_object('allowed', true, 'blocked', false, 'used', current_count, 'limit', current_limit, 'plan', current_plan);
end;
$$;

revoke all on function public.consume_monthly_quota(text) from public, anon;
grant execute on function public.consume_monthly_quota(text) to authenticated;

create or replace function public.release_monthly_quota(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_month text := to_char(now() at time zone 'Europe/Rome', 'YYYY-MM');
begin
  if current_user_id is null or p_kind not in ('analysis', 'mentor') then
    raise exception 'Unauthorized quota request';
  end if;

  if p_kind = 'analysis' then
    update public.user_entitlements
    set analysis_count = greatest(analysis_count - 1, 0), updated_at = now()
    where user_id = current_user_id and analysis_month = current_month;
  else
    update public.user_entitlements
    set mentor_query_count = greatest(mentor_query_count - 1, 0), updated_at = now()
    where user_id = current_user_id and mentor_query_month = current_month;
    update public.profiles
    set mentor_query_count = greatest(mentor_query_count - 1, 0), updated_at = now()
    where id = current_user_id and mentor_query_month = current_month;
  end if;
end;
$$;

revoke all on function public.release_monthly_quota(text) from public, anon;
grant execute on function public.release_monthly_quota(text) to authenticated;