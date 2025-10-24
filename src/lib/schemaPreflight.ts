// Schema preflight checks for Supabase
// Runs on client to alert if expected columns/tables are missing

import { supabase } from '@/lib/supabaseClient'

const SCHEMA_PREFLIGHT_REV = '2025-09-25-r2'

export type SchemaIssue = {
  resource: string
  problem: string
  fix?: string
}

// Minimal HTTP/SQL feature detection using describe endpoints
// We query a fast count constrained by a filter on a possibly-missing column.
// If Supabase returns a PostgREST error mentioning the column, we surface it.
async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table as any).select(`${column}`).limit(1)
    if (error) {
      // PostgREST provides details if the column is unknown
      if (error.message?.toLowerCase()?.includes('column') && error.message?.toLowerCase()?.includes('does not exist')) {
        return false
      }
      // If other error (like RLS) we assume column exists
      return true
    }
    return true
  } catch {
    return true
  }
}

export async function runSchemaPreflight(): Promise<SchemaIssue[]> {
  const checks: Array<Promise<{ table: string; column: string; exists: boolean }>> = []

  const check = (table: string, column: string) =>
    columnExists(table, column).then(exists => ({ table, column, exists }))

  // Only check columns that can block saving subjects/goals/calendar events.
  checks.push(
    // Subjects
    check('subjects', 'user_id'),
    check('subjects', 'start_date'),
    check('subjects', 'exam_date'),
    // Goals (critical fields used on insert/update)
    check('goals', 'user_id'),
    check('goals', 'subject_id'),
    check('goals', 'title'),
    check('goals', 'current_value'),
    check('goals', 'target_value'),
    check('goals', 'unit'),
    check('goals', 'completed'),
    check('goals', 'due_date'),
    check('goals', 'reminder_days'),
    // Calendar events (critical fields for analytics)
    check('calendar_events', 'user_id'),
    check('calendar_events', 'energy_level'),
    check('calendar_events', 'importance'),
    check('calendar_events', 'work_type'),
    check('calendar_events', 'study_difficulty'),
    check('calendar_events', 'mood_after'),
    check('calendar_events', 'goal_achievement')
  )

  const results = await Promise.all(checks)
  try { console.debug('[schemaPreflight]', SCHEMA_PREFLIGHT_REV, results) } catch {}
  const issues: SchemaIssue[] = []

  for (const { table, column, exists } of results) {
    if (!exists) {
      issues.push({
        resource: `${table}.${column}`,
        problem: 'Missing column',
        fix:
          table === 'calendar_events'
            ? 'Apply the calendar migrations in supabase/migrations or run "supabase db push".'
            : 'Apply the subjects/goals migrations in supabase/migrations or run "supabase db push".',
      })
    }
  }

  return issues
}

