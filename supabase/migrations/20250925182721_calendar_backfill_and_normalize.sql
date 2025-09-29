-- Backfill calendar_events and normalize goal deadlines; idempotent and safe.

-- 1) Ensure required columns exist (no-ops if already present)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY
);

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS start timestamptz,
  ADD COLUMN IF NOT EXISTS "end" timestamptz,
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS end_time timestamptz,
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS energy_level integer,
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Restore visibility: backfill user_id for rows with NULL user_id.
--    Uses newest auth user (typical for single-user dev projects).
WITH uid AS (
  SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1
)
UPDATE public.calendar_events ce
SET user_id = (SELECT id FROM uid)
WHERE ce.user_id IS NULL;

-- 3) Add black/white theme tags wherever 'deadline' is present (no duplicates)
UPDATE public.calendar_events
SET tags = (
  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(tags, ARRAY[]::text[]) || ARRAY['theme:black','fg:white']) AS u(x)
  )
)
WHERE 'deadline' = ANY(tags);

-- 4) Normalize goal deadline events to 08:00-09:00 on their day
UPDATE public.calendar_events
SET
  start_time = date_trunc('day', COALESCE(start_time, start)) + interval '8 hour',
  end_time   = date_trunc('day', COALESCE(start_time, start)) + interval '9 hour',
  start      = date_trunc('day', COALESCE(start, start_time)) + interval '8 hour',
  "end"      = date_trunc('day', COALESCE(start, start_time)) + interval '9 hour'
WHERE work_type = 'goal_deadline';

-- 5) RLS safety (enable + own-row policies)
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
