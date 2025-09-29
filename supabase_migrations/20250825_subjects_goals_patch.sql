-- Patch subjects and goals tables to match frontend expectations
-- Run this in Supabase SQL editor (recommended) or any psql connection to your project's database.

-- Subjects: add missing columns used by the app
create schema if not exists public;

alter table if exists public.subjects
  add column if not exists start_date date,
  add column if not exists exam_date date;

-- Helpful indexes
create index if not exists idx_subjects_user_id on public.subjects(user_id);
create index if not exists idx_subjects_name on public.subjects(name);

-- Goals: ensure columns used by the app exist (non-destructive)
-- Note: these columns may already exist in your project. The IF NOT EXISTS guards prevent errors.
alter table if exists public.goals
  add column if not exists subject_id uuid references public.subjects(id) on delete cascade,
  add column if not exists parent_goal_id uuid references public.goals(id) on delete cascade,
  add column if not exists text text,
  add column if not exists completed boolean default false,
  add column if not exists due_date date,
  add column if not exists reminder_days integer,
  add column if not exists progress_current integer,
  add column if not exists progress_total integer,
  add column if not exists notes text,
  add column if not exists tags jsonb default '[]'::jsonb;

-- Helpful indexes for goals
create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_goals_subject_id on public.goals(subject_id);
create index if not exists idx_goals_parent_goal_id on public.goals(parent_goal_id);
create index if not exists idx_goals_due_date on public.goals(due_date);

-- RLS policies (idempotent re-creation guarded by names)
-- Subjects
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'Users can view their own subjects') then
    execute 'create policy "Users can view their own subjects" on public.subjects for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'Users can insert their own subjects') then
    execute 'create policy "Users can insert their own subjects" on public.subjects for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'Users can update their own subjects') then
    execute 'create policy "Users can update their own subjects" on public.subjects for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'Users can delete their own subjects') then
    execute 'create policy "Users can delete their own subjects" on public.subjects for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- Goals
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'goals' and policyname = 'Users can view their own goals') then
    execute 'create policy "Users can view their own goals" on public.goals for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'goals' and policyname = 'Users can insert their own goals') then
    execute 'create policy "Users can insert their own goals" on public.goals for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'goals' and policyname = 'Users can update their own goals') then
    execute 'create policy "Users can update their own goals" on public.goals for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'goals' and policyname = 'Users can delete their own goals') then
    execute 'create policy "Users can delete their own goals" on public.goals for delete using (auth.uid() = user_id)';
  end if;
end $$;

