import { supabase } from '@/lib/supabaseClient'

// Local storage key for calendar events created from goals (legacy, kept for compatibility)
const LS_KEY = 'studyverse_calendar_events'
// Main calendar cache key used by the Calendar page
const MAIN_CAL_LS_KEY = 'calendar_events'

export type LightweightEvent = {
  id: string
  title: string
  description?: string
  start: string // ISO
  end: string // ISO
  allDay?: boolean
  tags?: string[]
}

function readLocalEvents(): LightweightEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLocalEvents(events: LightweightEvent[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(events))
  } catch {}
}

// Read/write the primary calendar cache used by the Calendar page
function readMainCalendarCache(): any[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MAIN_CAL_LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
function writeMainCalendarCache(events: any[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MAIN_CAL_LS_KEY, JSON.stringify(events))
  } catch {}
}

// Best-effort energy detection from local storage (optional)
function getCurrentEnergyLevel(): number | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    // Common local keys we might have set elsewhere in the app/analytics
    const candidates = [
      'today_energy_avg',
      'energy_level',
      'analytics_energy_level',
      'current_energy_level'
    ]
    for (const key of candidates) {
      const v = localStorage.getItem(key)
      if (v != null) {
        const n = Number(v)
        if (!Number.isNaN(n) && n >= 1 && n <= 5) return n
      }
    }
  } catch {}
  return undefined
}

export async function addOrUpdateGoalCalendarEvent(params: {
  goalId: string
  title: string
  dateISO: string // date-only or full ISO
  durationMinutes?: number
  description?: string
  energyLevelOverride?: number // optional explicit energy level 1..5
}) {
  const { goalId, title, dateISO, durationMinutes = 60, description, energyLevelOverride } = params
  const id = goalId

  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  if (!userId) return

  // Build baseDate robustly so 08:00 is LOCAL time, regardless of browser parsing quirks.
  let baseDate: Date
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateISO)
  if (dateOnly) {
    const [y, m, d] = dateISO.split('-').map(Number)
    // new Date(y, m-1, d, 8, 0, 0, 0) produces local 08:00
    baseDate = new Date(y, m - 1, d, 8, 0, 0, 0)
  } else {
    const parsed = new Date(dateISO)
    if (isNaN(parsed.getTime())) return
    // If time component is 00:00, shift to 08:00 local
    if (
      parsed.getHours() === 0 &&
      parsed.getMinutes() === 0 &&
      parsed.getSeconds() === 0 &&
      parsed.getMilliseconds() === 0
    ) {
      parsed.setHours(8, 0, 0, 0)
    }
    baseDate = parsed
  }
  const end = new Date(baseDate.getTime() + durationMinutes * 60 * 1000)

  // LocalStorage upsert (legacy key)
  const existing = readLocalEvents()
  const rest = existing.filter(e => e.id !== id)
  const energyLevel = energyLevelOverride ?? getCurrentEnergyLevel()
  const isLowEnergy = typeof energyLevel === 'number' ? energyLevel <= 2 : false

  const next: LightweightEvent = {
    id,
    title,
    description,
    start: baseDate.toISOString(),
    end: end.toISOString(),
    tags: ['goal', 'deadline', 'duedate', 'theme:black', 'fg:white'].concat(isLowEnergy ? ['low-energy'] : []),
  }
  writeLocalEvents([...rest, next])

  // Also write into the main calendar cache used by the Calendar UI
  try {
    const main = readMainCalendarCache()
    const filtered = (Array.isArray(main) ? main : []).filter((e: any) => e && e.id !== id)
    const uiEvent = {
      id,
      title,
      description: description ?? undefined,
      start: next.start,
      end: next.end,
      allDay: false,
      tags: next.tags ?? [],
      energyLevel: energyLevel ?? undefined,
      workType: 'goal_deadline',
    }
    writeMainCalendarCache([...filtered, uiEvent])
  } catch {}

  // Persist to Supabase calendar_events via upsert (updates start/end for existing deadline events)
  try {
    const payload: any = {
      id,
      user_id: userId,
      title,
      description: description ?? null,
      start: next.start,
      end: next.end,
      // Provide legacy columns for compatibility with existing schema
      start_time: next.start,
      end_time: next.end,
      all_day: false,
      tags: next.tags ?? [],
      energy_level: energyLevel ?? null,
      work_type: 'goal_deadline',
    }
    const res = await (supabase as any)
      .from('calendar_events')
      .upsert(payload, { onConflict: 'id' })
    const err = (res as any)?.error
    if (err) {
      try { console.warn('[calendar-bridge] calendar upsert failed', err) } catch {}
    } else {
      try { console.debug('[calendar-bridge] calendar event upserted', payload) } catch {}
    }
  } catch (e) {
    // swallow network/auth failures; localStorage already updated
    try { console.warn('[calendar-bridge] calendar upsert exception', e) } catch {}
  }
}

export async function removeGoalCalendarEvent(goalId: string) {
  const id = goalId
  // LocalStorage delete (legacy key)
  const existing = readLocalEvents()
  const next = existing.filter(e => e.id !== id)
  writeLocalEvents(next)
  // Also delete from the main calendar cache
  try {
    const main = readMainCalendarCache()
    const filtered = (Array.isArray(main) ? main : []).filter((e: any) => e && e.id !== id)
    writeMainCalendarCache(filtered)
  } catch {}

  // Supabase delete
  await supabase.from('calendar_events').delete().eq('id', id)
}

// Optional helper for calendar UI styling by tags
export function styleFromTags(tags: string[] = []) {
  const t = new Set(tags)
  const style: any = {}
  // Deadline always overrides energy-based styling
  if (t.has('deadline')) { style.backgroundColor = '#000'; style.color = '#fff' }
  if (t.has('theme:black')) style.backgroundColor = '#000'
  if (t.has('fg:white')) style.color = '#fff'
  return style
}

function uniqueTags(list: string[]): string[] {
  const set = new Set<string>()
  list.forEach(x => { if (x && typeof x === 'string') set.add(x) })
  return Array.from(set)
}

export function hasDeadlineTag(tags?: string[] | null): boolean {
  return Array.isArray(tags) ? tags.includes('deadline') : false
}

export async function markEventAsDeadline(eventId: string) {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  if (!userId) throw new Error('Not signed in')
  const { data: row, error } = await (supabase as any)
    .from('calendar_events')
    .select('id,tags')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  if (!row) throw new Error('Event not found')
  const next = uniqueTags([...(row.tags || []), 'deadline', 'duedate', 'theme:black', 'fg:white', 'color:locked:black'])
  const { error: updErr } = await (supabase as any)
    .from('calendar_events')
    .update({ tags: next })
    .eq('id', eventId)
  if (updErr) throw updErr
}

export async function unmarkEventAsDeadline(eventId: string) {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  if (!userId) throw new Error('Not signed in')
  const { data: row, error } = await (supabase as any)
    .from('calendar_events')
    .select('id,tags')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  if (!row) return
  const remove = new Set(['deadline','duedate','theme:black','fg:white','color:locked:black'])
  const next = uniqueTags((row.tags || []).filter((t: string) => !remove.has(t)))
  const { error: updErr } = await (supabase as any)
    .from('calendar_events')
    .update({ tags: next })
    .eq('id', eventId)
  if (updErr) throw updErr
}

