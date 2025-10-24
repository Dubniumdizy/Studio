-- Add analytics fields to calendar_events table for enhanced tracking
-- These fields support the analytics dashboard functionality

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS study_difficulty INTEGER CHECK (study_difficulty >= 1 AND study_difficulty <= 5),
ADD COLUMN IF NOT EXISTS mood_after INTEGER CHECK (mood_after >= 1 AND mood_after <= 5),
ADD COLUMN IF NOT EXISTS goal_achievement DECIMAL(2,1) CHECK (goal_achievement IN (0, 0.5, 1));

-- Add comments to document the new columns
COMMENT ON COLUMN calendar_events.study_difficulty IS 'Study difficulty rating from 1 (easiest) to 5 (hardest)';
COMMENT ON COLUMN calendar_events.mood_after IS 'Mood/happiness rating after completing the activity from 1 (lowest) to 5 (highest)';
COMMENT ON COLUMN calendar_events.goal_achievement IS 'Goal achievement level: 0=achieved less than goal, 0.5=achieved exactly the goal, 1=achieved more than goal';

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_analytics 
ON calendar_events (user_id, work_type, energy_level, study_difficulty, mood_after, goal_achievement);
