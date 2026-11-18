-- QuizCraft schema for Supabase (Postgres)
-- Run in Supabase SQL editor. Enables RLS and core policies.

create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles insertable by owner" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles updatable by owner" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quizzes
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','published')),
  theme jsonb not null default '{"accent":"#0f766e","paper":"#f3ede2","ink":"#18212b","font":"editorial","radius":"soft"}'::jsonb,
  settings jsonb not null default '{"mode":"scored","showAnswers":"after_each","passMark":70,"shuffleQuestions":false,"shuffleOptions":false,"collectName":false,"collectEmail":false,"oneQuestionPerPage":true,"showProgressBar":true,"allowRetake":true,"showScore":true,"certificateEnabled":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quizzes_owner_id_idx on public.quizzes(owner_id);
create index if not exists quizzes_slug_idx on public.quizzes(slug);

alter table public.quizzes enable row level security;

create policy "owners manage own quizzes" on public.quizzes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "published quizzes are publicly readable" on public.quizzes
  for select using (status = 'published');

-- Questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  type text not null check (type in ('multiple_choice','multi_select','true_false','short_text','long_text','number','dropdown','ranking','matching','section')),
  prompt text not null,
  description text not null default '',
  image_url text,
  required boolean not null default true,
  options jsonb not null default '[]'::jsonb, -- [{id,text,imageUrl?}] and/or matching definitions stored in options/meta
  correct jsonb not null default '[]'::jsonb, -- answer key shape depends on type
  match_pairs jsonb not null default '[]'::jsonb, -- [{id,left,right}] convenience for matching editor
  match_correct jsonb not null default '{}'::jsonb, -- {pairId: rightId/pairId}
  points numeric not null default 1 check (points >= 0),
  explanation text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists questions_quiz_id_idx on public.questions(quiz_id);

alter table public.questions enable row level security;

create policy "owners manage questions of own quizzes" on public.questions
  for all using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid())
  );

create policy "questions readable for published quizzes" on public.questions
  for select using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.status = 'published')
  );

-- Responses
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  respondent_name text,
  respondent_email text,
  answers jsonb not null default '{}'::jsonb, -- {questionId: value}
  score numeric not null default 0,
  total numeric not null default 0,
  percent numeric,
  passed boolean,
  grade_label text,
  duration_seconds int,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists responses_quiz_id_idx on public.responses(quiz_id);
create index if not exists responses_created_at_idx on public.responses(created_at desc);

alter table public.responses enable row level security;

-- Anyone can submit a response to a published quiz
create policy "anyone can submit response to published quiz" on public.responses
  for insert with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.status = 'published')
  );

-- Owners can read responses to their quizzes
create policy "owners can read responses" on public.responses
  for select using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid())
  );

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

-- Optional lightweight migration helpers for existing installs
alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check check (type in ('multiple_choice','multi_select','true_false','short_text','long_text','number','dropdown','ranking','matching','section'));
alter table public.questions add column if not exists description text not null default '';
alter table public.questions add column if not exists image_url text;
alter table public.questions add column if not exists required boolean not null default true;
alter table public.questions add column if not exists match_pairs jsonb not null default '[]'::jsonb;
alter table public.questions add column if not exists match_correct jsonb not null default '{}'::jsonb;
alter table public.questions alter column points type numeric using points::numeric;
alter table public.responses add column if not exists respondent_email text;
alter table public.responses add column if not exists percent numeric;
alter table public.responses add column if not exists grade_label text;
alter table public.responses add column if not exists duration_seconds int;
alter table public.responses add column if not exists meta jsonb not null default '{}'::jsonb;

-- Privileges for Supabase API roles (RLS policies still enforce row-level access).
-- Required when table privileges are not pre-granted in your project.
grant usage on schema public to anon, authenticated;

grant select on table public.profiles to authenticated;
grant insert, update on table public.profiles to authenticated;

grant select on table public.quizzes to anon, authenticated;
grant insert, update, delete on table public.quizzes to authenticated;

grant select on table public.questions to anon, authenticated;
grant insert, update, delete on table public.questions to authenticated;

grant insert on table public.responses to anon, authenticated;
grant select on table public.responses to authenticated;

-- Reload PostgREST schema cache (helpful after DDL/grant changes)
notify pgrst, 'reload schema';
