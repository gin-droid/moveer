create table public.user_store_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google_play')),
  plan text not null default 'freemium' check (plan in ('freemium', 'pro', 'coach')),
  product_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_store_entitlements enable row level security;
revoke all on table public.user_store_entitlements from public, anon, authenticated;
grant all on table public.user_store_entitlements to service_role;

create table public.google_play_purchases (
  purchase_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text,
  subscription_state text not null,
  expires_at timestamptz,
  order_id text,
  updated_at timestamptz not null default now()
);

create index google_play_purchases_user_id_idx
  on public.google_play_purchases (user_id);

alter table public.google_play_purchases enable row level security;
revoke all on table public.google_play_purchases from public, anon, authenticated;
grant all on table public.google_play_purchases to service_role;

insert into public.user_store_entitlements (user_id, provider, plan, product_id, expires_at)
select
  user_id,
  case billing_provider when 'google' then 'google_play' else billing_provider end,
  plan,
  store_product_id,
  subscription_expires_at
from public.user_entitlements
where billing_provider in ('apple', 'google')
  and plan in ('pro', 'coach')
  and (subscription_expires_at is null or subscription_expires_at > now())
on conflict (user_id, provider) do nothing;

create or replace function public.get_effective_entitlement_plan()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when entitlement.billing_provider = 'admin' then entitlement.plan
        else coalesce((
          select store_entitlement.plan
          from public.user_store_entitlements as store_entitlement
          where store_entitlement.user_id = auth.uid()
            and (store_entitlement.expires_at is null or store_entitlement.expires_at > now())
            and store_entitlement.plan in ('pro', 'coach')
          order by case store_entitlement.plan when 'coach' then 2 else 1 end desc
          limit 1
        ), 'freemium')
      end
      from public.user_entitlements as entitlement
      where entitlement.user_id = auth.uid()
    ),
    'freemium'
  );
$$;

revoke all on function public.get_effective_entitlement_plan() from public, anon;
grant execute on function public.get_effective_entitlement_plan() to authenticated, service_role;

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

  if entitlement.blocked then
    return jsonb_build_object('allowed', false, 'blocked', true, 'used', 0, 'limit', 0, 'plan', coalesce(entitlement.plan, 'freemium'));
  end if;

  current_plan := public.get_effective_entitlement_plan();
  if entitlement.billing_provider is distinct from 'admin' then
    update public.user_entitlements
    set plan = current_plan, updated_at = now()
    where user_id = current_user_id;
    update public.profiles
    set plan = current_plan, updated_at = now()
    where id = current_user_id;
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
