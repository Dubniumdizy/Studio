-- Fix subjects/goals/calendar schema to match app expectations (no backslash-escaped quotes)
-- Timestamp: 2025-09-25 16:47:38Z

-- Ensure pgcrypto is available (used elsewhere for gen_random_uuid())
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION pgcrypto;
  END IF;
END $$;

-- SUBJECTS: required columns
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS exam_date date;

-- GOALS: align with supabase-goals.ts usage
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS parent_goal_id uuid,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Untitled goal',
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS reminder_days integer,
  ADD COLUMN IF NOT EXISTS current_value integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_value integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'count';

-- Optionally drop default on title after ensuring non-null data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals'
      AND column_name = 'title' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE public.goals ALTER COLUMN title DROP DEFAULT;
  END IF;
END $$;

-- Enable RLS (safe if already enabled)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- SUBJECTS policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subjects' AND policyname='subjects_select_own'
  ) THEN
    CREATE POLICY subjects_select_own ON public.subjects FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subjects' AND policyname='subjects_ins_own'
  ) THEN
    CREATE POLICY subjects_ins_own ON public.subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subjects' AND policyname='subjects_upd_own'
  ) THEN
    CREATE POLICY subjects_upd_own ON public.subjects FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subjects' AND policyname='subjects_del_own'
  ) THEN
    CREATE POLICY subjects_del_own ON public.subjects FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- GOALS policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goals' AND policyname='goals_select_own'
  ) THEN
    CREATE POLICY goals_select_own ON public.goals FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goals' AND policyname='goals_ins_own'
  ) THEN
    CREATE POLICY goals_ins_own ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goals' AND policyname='goals_upd_own'
  ) THEN
    CREATE POLICY goals_upd_own ON public.goals FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goals' AND policyname='goals_del_own'
  ) THEN
    CREATE POLICY goals_del_own ON public.goals FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- CALENDAR EVENTS: create if missing, with correctly quoted "end"
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  start timestamptz NOT NULL,
  "end" timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  tags text[] DEFAULT '{}',
  energy_level integer,
  work_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events' AND policyname='calendar_events_select_own'
  ) THEN
    CREATE POLICY calendar_events_select_own ON public.calendar_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events' AND policyname='calendar_events_ins_own'
  ) THEN
    CREATE POLICY calendar_events_ins_own ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events' AND policyname='calendar_events_upd_own'
  ) THEN
    CREATE POLICY calendar_events_upd_own ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events' AND policyname='calendar_events_del_own'
  ) THEN
    CREATE POLICY calendar_events_del_own ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

