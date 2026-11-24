create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  gender text check (gender in ('maschio', 'femmina')),
  accent_color text,
  preferred_macro_categories text[] not null default '{}',
  preferred_equipment text[] not null default '{}',
  plan text not null default 'freemium' check (plan in ('freemium', 'pro', 'coach')),
  logo_url text,
  blocked boolean not null default false,
  mentor_query_count integer not null default 0,
  mentor_query_month text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'freemium' check (plan in ('freemium', 'pro', 'coach')),
  blocked boolean not null default false,
  mentor_query_count integer not null default 0,
  mentor_query_month text,
  analysis_count integer not null default 0,
  analysis_month text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  name text not null,
  macro_category text not null,
  subcategory text not null,
  description text,
  muscle_groups text[] not null default '{}',
  equipment text,
  difficulty text not null check (difficulty in ('Principiante', 'Intermedio', 'Avanzato')),
  setup_instructions text,
  common_mistakes text[] not null default '{}',
  image_url text,
  demo_video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exercises
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists name text,
  add column if not exists macro_category text,
  add column if not exists subcategory text,
  add column if not exists muscle_groups text[] not null default '{}',
  add column if not exists equipment text,
  add column if not exists difficulty text,
  add column if not exists setup_instructions text,
  add column if not exists common_mistakes text[] not null default '{}',
  add column if not exists image_url text,
  add column if not exists demo_video_url text,
  add column if not exists updated_at timestamptz not null default now();

update public.exercises set name = title where name is null;
update public.exercises set title = name where title is null;
update public.exercises set macro_category = category where macro_category is null;
update public.exercises set category = macro_category where category is null;
alter table public.exercises alter column name set not null;
alter table public.exercises alter column title set not null;

create or replace function public.sync_exercise_legacy_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.name := coalesce(new.name, new.title);
    new.title := coalesce(new.title, new.name);
    new.macro_category := coalesce(new.macro_category, new.category);
    new.category := coalesce(new.category, new.macro_category);
  else
    if new.name is distinct from old.name then
      new.title := new.name;
    elsif new.title is distinct from old.title then
      new.name := new.title;
    end if;
    if new.macro_category is distinct from old.macro_category then
      new.category := new.macro_category;
    elsif new.category is distinct from old.category then
      new.macro_category := new.category;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_exercise_legacy_fields on public.exercises;
create trigger sync_exercise_legacy_fields
  before insert or update on public.exercises
  for each row execute procedure public.sync_exercise_legacy_fields();

create index if not exists exercises_name_idx on public.exercises (name);
create index if not exists exercises_category_idx on public.exercises (macro_category, subcategory);

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  gender text check (gender in ('maschio', 'femmina')),
  birth_date date,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athletes
  add column if not exists birth_date date,
  add column if not exists email text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.athletes alter column user_id set default auth.uid();

create index if not exists athletes_user_created_idx on public.athletes (user_id, created_at desc);

create table if not exists public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  athlete_id uuid references public.athletes(id) on delete set null,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  macro_category text,
  subcategory text,
  gender text check (gender in ('maschio', 'femmina')),
  video_url text,
  biomechanics_data jsonb,
  video_uri text,
  depth_metadata jsonb,
  depth_analysis jsonb,
  wearable_data jsonb,
  score numeric check (score between 0 and 100),
  summary text,
  issues_detected jsonb not null default '[]'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  corrective_exercises jsonb not null default '[]'::jsonb,
  selected_corrective_exercises jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  body_diagram jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analysis_reports
  add column if not exists exercise_id uuid references public.exercises(id) on delete set null,
  add column if not exists exercise_name text,
  add column if not exists macro_category text,
  add column if not exists subcategory text,
  add column if not exists gender text,
  add column if not exists video_uri text,
  add column if not exists biomechanics_data jsonb,
  add column if not exists depth_metadata jsonb,
  add column if not exists depth_analysis jsonb,
  add column if not exists wearable_data jsonb,
  add column if not exists score numeric,
  add column if not exists summary text,
  add column if not exists issues_detected jsonb not null default '[]'::jsonb,
  add column if not exists corrections jsonb not null default '[]'::jsonb,
  add column if not exists corrective_exercises jsonb not null default '[]'::jsonb,
  add column if not exists selected_corrective_exercises jsonb not null default '[]'::jsonb,
  add column if not exists recommendations jsonb not null default '[]'::jsonb,
  add column if not exists body_diagram jsonb,
  add column if not exists updated_at timestamptz not null default now();
alter table public.analysis_reports alter column user_id set default auth.uid();

create index if not exists analysis_reports_user_created_idx on public.analysis_reports (user_id, created_at desc);
create index if not exists analysis_reports_athlete_idx on public.analysis_reports (athlete_id);

create table public.mentor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.mentor_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index mentor_messages_conversation_idx on public.mentor_messages (conversation_id, created_at);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, gender)
  values (new.id, new.email, new.raw_user_meta_data ->> 'gender')
  on conflict (id) do update set email = excluded.email;

  insert into public.user_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    new.role is distinct from old.role or
    new.plan is distinct from old.plan or
    new.blocked is distinct from old.blocked
  ) then
    raise exception 'Profile privilege fields are managed by an administrator';
  end if;
  return new;
end;
$$;

create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute procedure public.protect_profile_privileges();

alter table public.profiles enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.exercises enable row level security;
alter table public.athletes enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.mentor_conversations enable row level security;
alter table public.mentor_messages enable row level security;

create policy "Profiles are readable by owner or admin" on public.profiles
  for select using (id = (select auth.uid()) or public.is_admin());
create policy "Profiles are editable by owner or admin" on public.profiles
  for update using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());
create policy "Admins can manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Entitlements are readable by owner or admin" on public.user_entitlements
  for select using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins can manage entitlements" on public.user_entitlements
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Exercises are readable by authenticated users" on public.exercises
  for select to authenticated using (true);
create policy "Admins can manage exercises" on public.exercises
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Athletes belong to their owner" on public.athletes
  for all using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
create policy "Reports belong to their owner" on public.analysis_reports
  for all using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

create policy "Conversations belong to their owner" on public.mentor_conversations
  for all using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
create policy "Messages belong to their conversation owner" on public.mentor_messages
  for all using (
    exists (
      select 1 from public.mentor_conversations c
      where c.id = conversation_id and (c.user_id = (select auth.uid()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.mentor_conversations c
      where c.id = conversation_id and (c.user_id = (select auth.uid()) or public.is_admin())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('analysis-media', 'analysis-media', false, 52428800),
  ('public-assets', 'public-assets', true, 10485760)
on conflict (id) do nothing;

create policy "Users manage their own analysis media" on storage.objects
  for all using (bucket_id = 'analysis-media' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'analysis-media' and owner_id = (select auth.uid())::text);
create policy "Users manage their own public assets" on storage.objects
  for all using (bucket_id = 'public-assets' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'public-assets' and owner_id = (select auth.uid())::text);

alter publication supabase_realtime add table public.mentor_messages;