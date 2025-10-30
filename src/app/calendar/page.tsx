'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar as CalendarIcon, 
  Target, 
  Settings, 
  Download,
  Upload
} from 'lucide-react'
import { EnhancedEventEditor } from '@/components/calendar/EnhancedEventEditor'
import { EnhancedEventDisplay } from '@/components/calendar/EnhancedEventDisplay'
import { ChoreTemplates } from '@/components/calendar/ChoreTemplates'
import { MonthView, WeekView, DayView } from '@/components/calendar/CalendarViews'
import { supabase } from '@/lib/supabaseClient'
import { runSchemaPreflight } from '@/lib/schemaPreflight'
import type { EnhancedCalendarEvent } from '@/types/enhanced-calendar'
import { 
  addDays, 
  addWeeks, 
  addMonths, 
  addYears, 
  startOfWeek, 
  endOfWeek, 
  format, 
  parseISO,
  isSameDay,
  differenceInDays,
  isBefore, 
  isAfter, 
  isEqual 
} from 'date-fns';

// Function to expand recurring events
const expandRecurringEvents = (events: EnhancedCalendarEvent[], rangeStart: Date, rangeEnd: Date): EnhancedCalendarEvent[] => {
  const expandedEvents: EnhancedCalendarEvent[] = [];
  
  events.forEach(event => {
    if (!event.recurrence || event.recurrence.type === 'none') {
      // Non-recurring event
      if (event.start >= rangeStart && event.start <= rangeEnd) {
        expandedEvents.push(event);
      }
      return;
    }
    
    const recurrence = event.recurrence;
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const duration = endDate.getTime() - startDate.getTime();
    const recurrenceEndDate = recurrence.endDate ? new Date(recurrence.endDate) : rangeEnd;
    
    let currentDate = new Date(startDate);
    let instanceCount = 0;
    const maxInstances = 100; // Prevent infinite loops
    
    // Ensure we don't exceed the recurrence end date
    const effectiveEndDate = recurrence.endDate ? new Date(recurrence.endDate) : rangeEnd;
    
    while (currentDate <= rangeEnd && currentDate <= effectiveEndDate && instanceCount < maxInstances) {
      if (currentDate >= rangeStart) {
        // Skip if this date is in the skip dates
        const skipDateMatch = recurrence.skipDates?.some(skipDate => 
          isSameDay(new Date(skipDate), currentDate)
        );

        if (!skipDateMatch) {
          const instanceEnd = new Date(currentDate.getTime() + duration);
          expandedEvents.push({
            ...event,
            id: `${event.id}-instance-${format(currentDate, 'yyyy-MM-dd-HH-mm')}`,
            start: new Date(currentDate),
            end: instanceEnd,
            isRecurring: true,
            originalEvent: event, // Store the complete original event
            originalId: event.id
          });
        }
      }
      
      // Calculate next occurrence
      switch (recurrence.type) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addDays(currentDate, 7);
          break;
        case 'biweekly':
          currentDate = addDays(currentDate, 14);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'yearly':
          currentDate = addYears(currentDate, 1);
          break;
        default:
          break;
      }
      instanceCount++;
    }
  });
  
  return expandedEvents;
};
import { toast } from '@/hooks/use-toast'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'

// Updated interfaces to match the new components
interface TodoItem {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  dueDate?: Date
  createdAt: Date
  updatedAt: Date
  tags: string[]
  estimatedTime?: number
  actualTime?: number
}

interface ChoreTemplate {
  id: string
  name: string
  description?: string
  estimatedDuration: number
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  customDays?: number
  priority: 'low' | 'medium' | 'high'
  category: string
  energyLevel: 1 | 2 | 3 | 4 | 5
  tags: string[]
  instructions?: string
  isActive: boolean
  lastCompleted?: Date
  nextDue?: Date
  createdAt: Date
  updatedAt: Date
}

interface ChoreSchedule {
  id: string
  templateId: string
  scheduledDate: Date
  completed: boolean
  actualDuration?: number
  notes?: string
}

type View = 'day' | 'week' | 'month'

// Custom hook to hide header on scroll
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      if (currentScroll > lastScroll.current && currentScroll > 80) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScroll.current = currentScroll;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return hidden;
}

// Utility to ensure event start/end are Date objects
function ensureEventDates(events: any[]): EnhancedCalendarEvent[] {
  return events.map(event => ({
    ...event,
    start: event.start instanceof Date ? event.start : new Date(event.start),
    end: event.end instanceof Date ? event.end : new Date(event.end)
  }));
}

// Merge events by id, preferring fields from "incoming" for conflicting ids
function mergeEventsById(base: EnhancedCalendarEvent[], incoming: EnhancedCalendarEvent[]): EnhancedCalendarEvent[] {
  const map = new Map<string, EnhancedCalendarEvent>()
  for (const ev of base) {
    if (ev && ev.id) map.set(ev.id, ev)
  }
  for (const ev of incoming) {
    if (ev && ev.id) map.set(ev.id, ev)
  }
  // Stable-ish order: sort by start time ascending when available
  const arr = Array.from(map.values())
  arr.sort((a, b) => {
    const at = a.start instanceof Date ? a.start.getTime() : new Date(a.start as any).getTime()
    const bt = b.start instanceof Date ? b.start.getTime() : new Date(b.start as any).getTime()
    if (isNaN(at) && isNaN(bt)) return 0
    if (isNaN(at)) return 1
    if (isNaN(bt)) return -1
    return at - bt
  })
  return arr
}

// Map between UI event and DB row
function eventToRow(event: EnhancedCalendarEvent, userId: string) {
  return {
    id: event.id,
    user_id: userId,
    title: event.title || '',
    description: event.description || null,
    start: event.start?.toISOString?.() || new Date(event.start as any).toISOString(),
    end: event.end?.toISOString?.() || new Date(event.end as any).toISOString(),
    all_day: !!event.allDay,
    tags: event.tags || [],
    energy_level: event.energyLevel ?? null,
    importance: event.importance ?? null,
    work_type: event.workType || null,
    study_difficulty: (event as any).studyDifficulty ?? null,
    mood_after: (event as any).moodAfter ?? null,
    goal_achievement: (event as any).goalAchievement ?? null,
    checklist: event.checklist || [],
    reminders: event.reminders || [],
    location: (event as any).location || null,
    recurrence: event.recurrence || null,
    original_id: (event as any).originalId || null,
  }
}

function rowToEvent(row: any): EnhancedCalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    start: new Date(row.start),
    end: new Date(row.end),
    allDay: !!row.all_day,
    tags: row.tags || [],
    energyLevel: row.energy_level ?? undefined,
    importance: row.importance ?? undefined,
    workType: row.work_type || undefined,
    studyDifficulty: row.study_difficulty ?? undefined,
    moodAfter: row.mood_after ?? undefined,
    goalAchievement: row.goal_achievement ?? undefined,
    checklist: row.checklist || [],
    reminders: row.reminders || [],
    location: row.location || undefined,
    recurrence: row.recurrence || { type: 'none' },
  } as EnhancedCalendarEvent
}

// Helpers to validate and sanitize event updates
function isValidDateValue(val: any): boolean {
  if (val === undefined || val === null) return false;
  const d = val instanceof Date ? val : new Date(val);
  return !isNaN(d.getTime());
}

function sanitizeEventPatch(patch: Partial<EnhancedCalendarEvent>, base: EnhancedCalendarEvent): Partial<EnhancedCalendarEvent> {
  const result: any = { ...patch };
  if ('start' in result && !isValidDateValue(result.start)) {
    delete result.start;
  }
  if ('end' in result && !isValidDateValue(result.end)) {
    delete result.end;
  }
  return result;
}

export default function EnhancedCalendarPage() {
  const [view, setView] = useState<View>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<EnhancedCalendarEvent[]>([])

  const [todos, setTodos] = useState<TodoItem[]>([
    {
      id: '1',
      title: 'Complete project proposal',
      description: 'Finish the quarterly project proposal',
      completed: false,
      priority: 'high',
      category: 'Work',
      dueDate: new Date(2024, 0, 20),
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['work', 'proposal'],
      estimatedTime: 120
    }
  ])

  const [choreTemplates, setChoreTemplates] = useState<ChoreTemplate[]>([
    {
      id: '1',
      name: 'Weekly Review',
      description: 'Review and plan for the week',
      estimatedDuration: 60,
      frequency: 'weekly',
      priority: 'high',
      category: 'Planning',
      energyLevel: 3,
      tags: ['planning', 'review'],
      isActive: true,
      nextDue: new Date(2024, 0, 22),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ])

  const [choreSchedules, setChoreSchedules] = useState<ChoreSchedule[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  // Load events from localStorage, then Supabase on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('calendar_events')
      if (cached) {
        const parsed = JSON.parse(cached)
        setEvents(ensureEventDates(parsed))
      }
    } catch {}

    const run = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) return
      const uid = data.session?.user?.id || null
      setUserId(uid)
      if (!uid) return
      const { data: rows, error: e2 } = await supabase
        .from('calendar_events')
        .select('id,title,description,start,end,all_day,tags,energy_level,importance,work_type,study_difficulty,mood_after,goal_achievement,checklist,reminders,location,recurrence,original_id')
        .eq('user_id', uid)
        .order('start', { ascending: true })
      if (!e2 && rows) {
        const mapped: EnhancedCalendarEvent[] = rows.map(rowToEvent)
        setEvents(prev => mergeEventsById(prev, mapped))
      }
    }
    run()
  }, [])

  // Persist calendar data locally as a cache
  useEffect(() => {
    try { localStorage.setItem('calendar_events', JSON.stringify(events)) } catch {}
  }, [events])
  // Listen to calendar cache changes from other tabs/pages and merge without wiping
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== 'calendar_events') return
      try {
        const raw = localStorage.getItem('calendar_events')
        if (!raw) return
        const parsed = JSON.parse(raw)
        const hydrated = ensureEventDates(Array.isArray(parsed) ? parsed : [])
        setEvents(prev => mergeEventsById(prev, hydrated))
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => {
    try { localStorage.setItem('calendar_todos', JSON.stringify(todos)) } catch {}
  }, [todos])
  useEffect(() => {
    try { localStorage.setItem('calendar_choreTemplates', JSON.stringify(choreTemplates)) } catch {}
  }, [choreTemplates])
  const [selectedEvent, setSelectedEvent] = useState<EnhancedCalendarEvent | null>(null)
  const [editorDefaults, setEditorDefaults] = useState<{
    date?: Date
    time?: string
  }>({})
  const [tagWarningThreshold, setTagWarningThreshold] = useState(5)
  const [headerImage, setHeaderImage] = useState<string | null>(null)
  const [bannerScale, setBannerScale] = useState<number>(1)
  const [bannerPos, setBannerPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 })
  const [isBannerEditorOpen, setIsBannerEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const importUrlInputRef = useRef<HTMLInputElement>(null)
  
  // Visible hours range
  const [minHour, setMinHour] = useState<number>(6)
  const [maxHour, setMaxHour] = useState<number>(23)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('calendar_hour_range')
      if (raw) {
        const obj = JSON.parse(raw)
        const start = Number(obj.start)
        const end = Number(obj.end)
        if (Number.isFinite(start)) setMinHour(Math.max(0, Math.min(23, start)))
        if (Number.isFinite(end)) setMaxHour(prev => Math.max(Number.isFinite(start)? Math.max(0, Math.min(23, start)) : minHour, Math.min(23, end)))
      }
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('calendar_hour_range', JSON.stringify({ start: minHour, end: maxHour })) } catch {}
  }, [minHour, maxHour])

  // Diary modal state
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [diaryPrompt, setDiaryPrompt] = useState('Something I learned today was...')
  const [diaryTime, setDiaryTime] = useState('21:00')
  // Warnings
  const warnings = useMemo(() => {
    const list: string[] = []
    const day = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    )
    const nextDay = new Date(day)
    nextDay.setDate(day.getDate() + 1)

    const hasTag = (e: any, t: string) =>
      (e.tags || []).some((x: string) => String(x).toLowerCase().trim() === t)
    const isStudy = (e: any) => e?.workType === 'deep' || hasTag(e, 'study') || (((e as any).studyDifficulty ?? 0) > 0)
    const hasStudyTag = (e: any) => hasTag(e, 'study')
    const isBreak = (e: any) => e?.workType === 'break' || hasTag(e, 'break')

    // Minutes of overlap between event and [start, end). Coerce to Date if needed.
    const overlapMinutes = (ev: EnhancedCalendarEvent, start: Date, end: Date) => {
      let evStart = ev.start instanceof Date ? ev.start : new Date(ev.start as any)
      let evEnd = ev.end instanceof Date ? ev.end : new Date(ev.end as any)
      // Guard against reversed times
      if (evEnd.getTime() < evStart.getTime()) {
        const tmp = evStart; evStart = evEnd; evEnd = tmp
      }
      const s = Math.max(evStart.getTime(), start.getTime())
      const e = Math.min(evEnd.getTime(), end.getTime())
      // Round minutes to avoid floating-point drift
      return Math.max(0, Math.round((e - s) / 60000))
    }

    // Include any event that overlaps today (coerce to Date for safety)
    const todays = events
      .filter((e) => {
        const evStart = e.start instanceof Date ? e.start : new Date(e.start as any)
        const evEnd = e.end instanceof Date ? e.end : new Date(e.end as any)
        return evStart < nextDay && evEnd > day
      })
      .slice()
      .sort((a, b) => {
        const as = a.start instanceof Date ? a.start : new Date(a.start as any)
        const bs = b.start instanceof Date ? b.start : new Date(b.start as any)
        return as.getTime() - bs.getTime()
      })

    // 1) Hard study (study tag + difficulty 5) > 1h within today
    for (let i = 0; i < todays.length; i++) {
      const e = todays[i]
      const durMin = overlapMinutes(e, day, nextDay)
      const diff = (e as any).studyDifficulty ?? 0
      if (hasStudyTag(e) && diff >= 5 && durMin >= 60) {
        list.push('You have studied a 5/5 difficult subject for +1h. Consider switching it up')
      }
    }

    // 2) Total study today (study tag only) > 5h, counting only overlapped minutes
    const totalStudyTodayMin = todays.reduce(
      (sum, e) => sum + (hasStudyTag(e) ? overlapMinutes(e, day, nextDay) : 0),
      0
    )
    if (totalStudyTodayMin >= 300)
      list.push('You studied over 5 hours today. Consider taking a longer break and winding down.')

    // 4) No study today and for the last two days (window = [twoDaysAgoStart, nextDay))
    const twoDaysAgo = new Date(day)
    twoDaysAgo.setDate(day.getDate() - 2)
    const twoDaysAgoStart = new Date(
      twoDaysAgo.getFullYear(),
      twoDaysAgo.getMonth(),
      twoDaysAgo.getDate()
    )
    const hadStudyLast3Days = events.some(
      (e) => e.end > twoDaysAgoStart && e.start < nextDay && isStudy(e)
    )
    if (!hadStudyLast3Days)
      list.push("You haven't studied for two days. Be careful to not procrastinate")

    return Array.from(new Set(list))
  }, [events, currentDate])

  // Example data toggle state
  const [exampleDataActive, setExampleDataActive] = useState(false);

  // Example data definitions
  type TodayFactory = () => Date;
  const getToday: TodayFactory = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };
  const today = getToday();

  const exampleEvents: EnhancedCalendarEvent[] = [
    // Day 1 (Today) - Monday
    {
      id: 'ex-1',
      title: 'Morning Routine',
      description: 'Wake up, shower, breakfast',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0),
      allDay: false,
      tags: ['example', 'routine'],
      energyLevel: 2,
      importance: 1,
      workType: 'personal',
      checklist: [],
      reminders: [],
      location: 'Home',
    },
    {
      id: 'ex-2',
      title: 'Linear Algebra Lecture',
      description: 'Room E31, Prof. Andersson',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0),
      allDay: false,
      tags: ['example', 'math', 'lecture'],
      energyLevel: 4,
      importance: 5,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'E31, Lindstedtsvägen',
    },
    {
      id: 'ex-3',
      title: 'Lunch Break',
      description: 'Campus cafeteria',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
      allDay: false,
      tags: ['example', 'break'],
      energyLevel: 1,
      importance: 1,
      workType: 'personal',
      checklist: [],
      reminders: [],
      location: 'Campus Cafeteria',
    },
    {
      id: 'ex-4',
      title: 'Physics Lab',
      description: 'Mechanics experiments',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0),
      allDay: false,
      tags: ['example', 'physics', 'lab'],
      energyLevel: 3,
      importance: 4,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Lab Building A',
    },
    {
      id: 'ex-5',
      title: 'Study Session - Math',
      description: 'Review linear algebra concepts',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0),
      allDay: false,
      tags: ['example', 'study', 'math'],
      energyLevel: 4,
      importance: 3,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Library',
    },
    {
      id: 'ex-6',
      title: 'Dinner',
      description: 'Cooking and eating',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 30),
      allDay: false,
      tags: ['example', 'meal'],
      energyLevel: 1,
      importance: 1,
      workType: 'personal',
      checklist: [],
      reminders: [],
      location: 'Home',
    },
    {
      id: 'ex-7',
      title: 'Evening Study',
      description: 'Physics homework',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0),
      allDay: false,
      tags: ['example', 'study', 'physics'],
      energyLevel: 3,
      importance: 4,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Home',
    },

    // Day 2 (Tomorrow) - Tuesday
    {
      id: 'ex-8',
      title: 'Morning Workout',
      description: 'Gym session',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 6, 30),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 7, 30),
      allDay: false,
      tags: ['example', 'exercise'],
      energyLevel: 3,
      importance: 2,
      workType: 'personal',
      checklist: [],
      reminders: [],
      location: 'Gym',
    },
    {
      id: 'ex-9',
      title: 'Calculus Lecture',
      description: 'Room U41, Prof. Lindberg',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 9, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 11, 0),
      allDay: false,
      tags: ['example', 'math', 'lecture'],
      energyLevel: 4,
      importance: 5,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'U41, Brinellvägen',
    },
    {
      id: 'ex-10',
      title: 'Group Project Meeting',
      description: 'Physics project discussion',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 13, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 15, 0),
      allDay: false,
      tags: ['example', 'group', 'physics'],
      energyLevel: 4,
      importance: 4,
      workType: 'shallow',
      checklist: [],
      reminders: [],
      location: 'Study Room 3',
    },
    {
      id: 'ex-11',
      title: 'Programming Tutorial',
      description: 'Python basics',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 15, 30),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 17, 0),
      allDay: false,
      tags: ['example', 'programming'],
      energyLevel: 3,
      importance: 3,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Computer Lab',
    },

    // Day 3 (Wednesday)
    {
      id: 'ex-12',
      title: 'Chemistry Lecture',
      description: 'Organic chemistry',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 10, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 12, 0),
      allDay: false,
      tags: ['example', 'chemistry', 'lecture'],
      energyLevel: 4,
      importance: 5,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Chemistry Building',
    },
    {
      id: 'ex-13',
      title: 'Chemistry Lab',
      description: 'Organic synthesis',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 14, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 17, 0),
      allDay: false,
      tags: ['example', 'chemistry', 'lab'],
      energyLevel: 3,
      importance: 4,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Chemistry Lab',
    },
    {
      id: 'ex-14',
      title: 'Study Group - Math',
      description: 'Problem solving session',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 18, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 20, 0),
      allDay: false,
      tags: ['example', 'study', 'math', 'group'],
      energyLevel: 4,
      importance: 3,
      workType: 'shallow',
      checklist: [],
      reminders: [],
      location: 'Library Study Room',
    },

    // Day 4 (Thursday)
    {
      id: 'ex-15',
      title: 'Physics Lecture',
      description: 'Quantum mechanics',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 9, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 11, 0),
      allDay: false,
      tags: ['example', 'physics', 'lecture'],
      energyLevel: 5,
      importance: 5,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Physics Building',
    },
    {
      id: 'ex-16',
      title: 'Office Hours',
      description: 'Math professor consultation',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 13, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 14, 0),
      allDay: false,
      tags: ['example', 'consultation'],
      energyLevel: 3,
      importance: 3,
      workType: 'shallow',
      checklist: [],
      reminders: [],
      location: 'Math Department',
    },
    {
      id: 'ex-17',
      title: 'Programming Assignment',
      description: 'Work on Python project',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 15, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 18, 0),
      allDay: false,
      tags: ['example', 'programming', 'assignment'],
      energyLevel: 4,
      importance: 4,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Computer Lab',
    },

    // Day 5 (Friday)
    {
      id: 'ex-18',
      title: 'Math Quiz',
      description: 'Linear algebra quiz',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 10, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 11, 0),
      allDay: false,
      tags: ['example', 'quiz', 'math'],
      energyLevel: 2,
      importance: 5,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Exam Hall',
    },
    {
      id: 'ex-19',
      title: 'Physics Discussion',
      description: 'Tutorial session',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 13, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 15, 0),
      allDay: false,
      tags: ['example', 'physics', 'tutorial'],
      energyLevel: 3,
      importance: 3,
      workType: 'shallow',
      checklist: [],
      reminders: [],
      location: 'Physics Tutorial Room',
    },
    {
      id: 'ex-20',
      title: 'Weekend Planning',
      description: 'Plan next week',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 16, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 17, 0),
      allDay: false,
      tags: ['example', 'planning'],
      energyLevel: 2,
      importance: 2,
      workType: 'shallow',
      checklist: [],
      reminders: [],
      location: 'Home',
    },

    // Day 6 (Saturday)
    {
      id: 'ex-21',
      title: 'Grocery Shopping',
      description: 'Weekly groceries',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 10, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 11, 30),
      allDay: false,
      tags: ['example', 'errands'],
      energyLevel: 1,
      importance: 1,
      workType: 'personal',
      checklist: [],
      reminders: [],
      location: 'Supermarket',
    },
    {
      id: 'ex-22',
      title: 'Study Session - Chemistry',
      description: 'Review organic chemistry',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 14, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 16, 0),
      allDay: false,
      tags: ['example', 'study', 'chemistry'],
      energyLevel: 4,
      importance: 3,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Library',
    },
    {
      id: 'ex-23',
      title: 'Movie Night',
      description: 'Relaxation time',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 20, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 22, 30),
      allDay: false,
      tags: ['example', 'entertainment'],
      energyLevel: 1,
      workType: 'personal',
      checklist: [],
      reminders: [],
      location: 'Home',
    },

    // Day 7 (Sunday)
    {
      id: 'ex-24',
      title: 'Laundry',
      description: 'Weekly laundry',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 9, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 10, 0),
      allDay: false,
      tags: ['example', 'chores'],
      energyLevel: 1,
      importance: 1,
      workType: 'personal',
      checklist: [],
      reminders: [],
      location: 'Home',
    },
    {
      id: 'ex-25',
      title: 'Exam Preparation',
      description: 'Study for upcoming exams',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 14, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 18, 0),
      allDay: false,
      tags: ['example', 'study', 'exam-prep'],
      energyLevel: 5,
      studyDifficulty: 5,
      importance: 5,
      workType: 'deep',
      checklist: [],
      reminders: [],
      location: 'Library',
    },
    {
      id: 'ex-26',
      title: 'Weekly Review',
      description: 'Review week and plan ahead',
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 20, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 21, 0),
      allDay: false,
      tags: ['example', 'planning', 'review'],
      energyLevel: 2,
      importance: 2,
      workType: 'shallow',
      checklist: [],
      reminders: [],
      location: 'Home',
    },
  ];

  const exampleTodos: TodoItem[] = [
    {
      id: 'ex-todo-1',
      title: 'Finish Linear Algebra Assignment',
      description: 'Complete all exercises in chapter 5',
      completed: false,
      priority: 'high',
      category: 'Math',
      dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
      createdAt: today,
      updatedAt: today,
      tags: ['example', 'math', 'assignment'],
      estimatedTime: 120,
    },
    {
      id: 'ex-todo-2',
      title: 'Buy groceries',
      description: 'Milk, eggs, bread, vegetables',
      completed: false,
      priority: 'medium',
      category: 'Personal',
      dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
      createdAt: today,
      updatedAt: today,
      tags: ['example', 'personal', 'errands'],
      estimatedTime: 45,
    },
    {
      id: 'ex-todo-3',
      title: 'Submit Physics Lab Report',
      description: 'Write up mechanics experiment results',
      completed: false,
      priority: 'high',
      category: 'Physics',
      dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3),
      createdAt: today,
      updatedAt: today,
      tags: ['example', 'physics', 'lab-report'],
      estimatedTime: 90,
    },
    {
      id: 'ex-todo-4',
      title: 'Review Chemistry Notes',
      description: 'Go through organic chemistry concepts',
      completed: false,
      priority: 'medium',
      category: 'Chemistry',
      dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4),
      createdAt: today,
      updatedAt: today,
      tags: ['example', 'chemistry', 'review'],
      estimatedTime: 60,
    },
    {
      id: 'ex-todo-5',
      title: 'Call parents',
      description: 'Weekly check-in call',
      completed: false,
      priority: 'low',
      category: 'Personal',
      dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6),
      createdAt: today,
      updatedAt: today,
      tags: ['example', 'personal', 'family'],
      estimatedTime: 30,
    },
  ];

  const exampleChoreTemplates: ChoreTemplate[] = [
    {
      id: 'ex-chore-1',
      name: 'Weekly Room Cleaning',
      description: 'Vacuum, dust, and tidy up the room',
      estimatedDuration: 60,
      frequency: 'weekly',
      priority: 'medium',
      category: 'Chores',
      energyLevel: 2,
      tags: ['example', 'cleaning'],
      isActive: true,
      createdAt: today,
      updatedAt: today,
    },
    {
      id: 'ex-chore-2',
      name: 'Laundry',
      description: 'Wash and fold clothes',
      estimatedDuration: 90,
      frequency: 'weekly',
      priority: 'medium',
      category: 'Chores',
      energyLevel: 1,
      tags: ['example', 'laundry'],
      isActive: true,
      createdAt: today,
      updatedAt: today,
    },
    {
      id: 'ex-chore-3',
      name: 'Grocery Shopping',
      description: 'Buy weekly groceries',
      estimatedDuration: 45,
      frequency: 'weekly',
      priority: 'high',
      category: 'Errands',
      energyLevel: 2,
      tags: ['example', 'groceries'],
      isActive: true,
      createdAt: today,
      updatedAt: today,
    },
  ];

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  
  const eventsInRange = useMemo(() => {
    return expandRecurringEvents(events, weekStart, weekEnd);  }, [events, weekStart, weekEnd])

  const navigateDate = (amount: number) => {
    if (view === 'day') setCurrentDate(d => addDays(d, amount))
    if (view === 'week') setCurrentDate(d => addWeeks(d, amount))
    if (view === 'month') setCurrentDate(d => addMonths(d, amount))
  }

  const handleEventClick = (event: EnhancedCalendarEvent) => {
    setSelectedEvent(event)
  }

  const handleEventEdit = (event: EnhancedCalendarEvent) => {
    setSelectedEvent(event)
    setIsEditorOpen(true)
  }

  const handleEventDelete = (eventId: string) => {
    // Try to find the event in the base events list
    const eventFromList = events.find(e => e.id === eventId);
    // Fallback to the currently selected event (likely an expanded instance)
    const targetEvent = eventFromList || selectedEvent;

    if (!targetEvent) {
      // Nothing to delete
      setSelectedEvent(null);
      return;
    }

    const isRecurring = !!(targetEvent.recurrence && targetEvent.recurrence.type !== 'none');
    const originalEvent = targetEvent.originalEvent || events.find(e => e.id === targetEvent.id);

    if (isRecurring && originalEvent && originalEvent.recurrence) {
      // Ask user if they want to delete all future occurrences
      const shouldDeleteAll = window.confirm(
        'This is a recurring event. Do you want to delete all future occurrences?'
      );

      if (shouldDeleteAll) {
        // Delete all future occurrences from the selected instance onward
        const anchor = new Date(targetEvent.start);
        const origStart = new Date(originalEvent.start);
        if (anchor.getTime() <= origStart.getTime()) {
          // If deleting from or before the first instance, remove entire series
          setEvents(prev => prev.filter(e => e.id !== originalEvent.id));
          if (userId) {
            supabase.from('calendar_events').delete().eq('id', originalEvent.id).then(({ error }) => {
              if (error) console.warn('Supabase delete failed', error.message)
            })
          }
        } else {
          const cutoff = new Date(anchor.getTime() - 1);
          const updatedOriginalEvent = {
            ...originalEvent,
            recurrence: {
              ...originalEvent.recurrence,
              endDate: cutoff
            }
          } as EnhancedCalendarEvent;
          setEvents(prev => prev.map(e =>
            e.id === originalEvent.id ? updatedOriginalEvent : e
          ));
          if (userId) {
            supabase.from('calendar_events').upsert(eventToRow(updatedOriginalEvent, userId)).then(({ error }) => {
              if (error) console.warn('Supabase upsert failed', error.message)
            })
          }
        }
      } else {
        // Update the original event to skip this specific instance
        const updatedOriginalEvent = {
          ...originalEvent,
          recurrence: {
            ...originalEvent.recurrence,
            skipDates: [...(originalEvent.recurrence.skipDates || []), targetEvent.start]
          }
        };

        setEvents(prev => prev.map(e =>
          e.id === originalEvent.id ? updatedOriginalEvent : e
        ));
        if (userId) {
          supabase.from('calendar_events').upsert(eventToRow(updatedOriginalEvent as EnhancedCalendarEvent, userId)).then(({ error }) => {
            if (error) console.warn('Supabase upsert failed', error.message)
          })
        }
      }
    } else {
      // Non-recurring event, delete normally. If targetEvent is an expanded instance, this path won't be taken.
      const idToRemove = eventFromList ? eventId : targetEvent.id;
      setEvents(prev => prev.filter(e => e.id !== idToRemove));
      if (userId) {
        supabase.from('calendar_events').delete().eq('id', idToRemove).then(({ error }) => {
          if (error) console.warn('Supabase delete failed', error.message)
        })
      }
    }

    // Close the event display
    setSelectedEvent(null);
  }
  const handleTimeSlotClick = (date: Date, time: string) => {
    setSelectedEvent(null)
    setEditorDefaults({ date, time })
    setIsEditorOpen(true)
  }

  const handleSaveEvent = (eventData: Partial<EnhancedCalendarEvent>) => {
    if (selectedEvent) {
      // Sanitize patch to avoid undefined/invalid dates wiping values
      const sanitizedPatch = sanitizeEventPatch(eventData, selectedEvent);
      // If user tried to clear time fields and nothing else changed, do nothing
      const triedToChangeTime = 'start' in eventData || 'end' in eventData;
      const actuallyChangedTime = ('start' in sanitizedPatch) || ('end' in sanitizedPatch);
      if (triedToChangeTime && !actuallyChangedTime) {
        toast({ title: 'No valid time provided', description: 'Time change ignored because it was empty/invalid.' });
      }
      // Check if this is a recurring event
      const isRecurring = selectedEvent.recurrence && selectedEvent.recurrence.type !== 'none';
      const originalEvent = selectedEvent.originalEvent || selectedEvent;
      
      if (isRecurring) {
        // Ask user what they want to do with recurring events
        const choice = window.confirm(
          'This is a recurring event. Click OK to apply changes to all future occurrences, or Cancel to change only this instance.'
        )
        
        if (choice) {
          // Apply changes to this and all future occurrences by splitting the series
          const anchor = new Date(selectedEvent.start);
          const originalStart = new Date(originalEvent.start);

          // If we're editing the first instance (or earlier, defensively), update the original directly
          if (anchor.getTime() <= originalStart.getTime()) {
            setEvents(prev => prev.map(e =>
              e.id === originalEvent.id
                ? { ...e, ...sanitizedPatch, recurrence: e.recurrence }
                : e
            ));
            setSelectedEvent(prev => prev ? { ...prev, ...sanitizedPatch, recurrence: prev.recurrence } : null);
            // Persist original update
            if (userId) {
              const updated = { ...originalEvent, ...sanitizedPatch }
              supabase.from('calendar_events').upsert(eventToRow(updated as EnhancedCalendarEvent, userId)).then(({ error }) => {
                if (error) console.warn('Supabase upsert failed', error.message)
              })
            }
          } else {
            // Split the series: end the original before the edited instance, create a new series from the edited instance
            const duration = new Date(originalEvent.end).getTime() - new Date(originalEvent.start).getTime();
            const cutoff = new Date(anchor.getTime() - 1); // end original just before the anchor

            const updatedOriginal = {
              ...originalEvent,
              recurrence: {
                ...originalEvent.recurrence,
                endDate: cutoff
              }
            } as EnhancedCalendarEvent;

            const nextStart = eventData.start ? new Date(eventData.start as any) : anchor;
            const inferredEnd = new Date(nextStart.getTime() + duration);
            const nextEnd = eventData.end ? new Date(eventData.end as any) : inferredEnd;

            const newSeries: EnhancedCalendarEvent = {
              ...originalEvent,
                ...sanitizedPatch,
              id: `${originalEvent.id}-split-${Date.now()}`,
              start: nextStart,
              end: nextEnd,
              recurrence: {
                ...originalEvent.recurrence,
                skipDates: originalEvent.recurrence?.skipDates ? [...originalEvent.recurrence.skipDates] : []
              },
              // Ensure this new series is a clean root event
              originalId: undefined,
              originalEvent: undefined,
              isRecurring: undefined as any
            } as EnhancedCalendarEvent;

            setEvents(prev => ([
              ...prev.map(e => (e.id === originalEvent.id ? updatedOriginal : e)),
              newSeries
            ]) as EnhancedCalendarEvent[]);
            setSelectedEvent(newSeries as EnhancedCalendarEvent);
            // Persist both updated original and new series
            if (userId) {
              const rows = [eventToRow(updatedOriginal, userId), eventToRow(newSeries, userId)]
              supabase.from('calendar_events').upsert(rows).then(({ error }) => {
                if (error) console.warn('Supabase upsert failed', error.message)
              })
            }
          }
        } else {
          // Create a new non-recurring instance
          const newEvent = {
            ...selectedEvent,
            ...sanitizedPatch,
            id: `${selectedEvent.id}-instance-${Date.now()}`,
            recurrence: { type: 'none' },
            originalId: originalEvent.id,
            originalEvent: originalEvent
          };
          
          // Add skip date to original event
          const updatedOriginalEvent = { ...originalEvent };
          if (!updatedOriginalEvent.recurrence.skipDates) {
            updatedOriginalEvent.recurrence.skipDates = [];
          }
          updatedOriginalEvent.recurrence.skipDates.push(selectedEvent.start);
          
          // Update events list with both the new instance and updated original
          setEvents(prev => ([
            ...prev.map(e => e.id === originalEvent.id ? (updatedOriginalEvent as EnhancedCalendarEvent) : e),
            newEvent as EnhancedCalendarEvent
          ]) as EnhancedCalendarEvent[]);
          
          // Persist both the updated original and the new instance
          if (userId) {
            const rows = [eventToRow(updatedOriginalEvent as EnhancedCalendarEvent, userId), eventToRow(newEvent as EnhancedCalendarEvent, userId)]
            supabase.from('calendar_events').upsert(rows).then(({ error }) => {
              if (error) console.warn('Supabase upsert failed', error.message)
            })
          }

          // Update selected event to show the new instance
          setSelectedEvent(newEvent as EnhancedCalendarEvent);
        }
      } else {
        // Non-recurring event, update normally
        const updatedEvent = { ...selectedEvent, ...sanitizedPatch };
        setEvents(prev => prev.map(e => 
          e.id === selectedEvent.id ? updatedEvent : e
        ));
        // Persist update
        if (userId) {
          supabase.from('calendar_events').upsert(eventToRow(updatedEvent as EnhancedCalendarEvent, userId)).then(({ error }) => {
            if (error) console.warn('Supabase upsert failed', error.message)
          })
        }
        // Update the selected event to show changes immediately
        setSelectedEvent(updatedEvent);
      }
    } else {
      const sanitized = sanitizeEventPatch(eventData, {
        // minimal base to validate against
        id: '', title: '', start: new Date(), end: new Date()
      } as any);
      const newEvent: EnhancedCalendarEvent = {
        id: `event-${Date.now()}`,
        title: '',
        start: new Date(),
        end: new Date(),
        ...sanitized
      } as EnhancedCalendarEvent
      setEvents(prev => [...prev, newEvent])
      // Persist create
      if (userId) {
        supabase.from('calendar_events').upsert(eventToRow(newEvent, userId)).then(({ error }) => {
          if (error) console.warn('Supabase upsert failed', error.message)
        })
      }
    }
    setIsEditorOpen(false)
  }

  const handleTodosChange = (newTodos: TodoItem[]) => {
    setTodos(newTodos)
  }

  const handleChoreTemplatesChange = (newTemplates: ChoreTemplate[]) => {
    setChoreTemplates(newTemplates)
  }

  const handleChoreSchedulesChange = (newSchedules: ChoreSchedule[]) => {
    setChoreSchedules(newSchedules)
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    events.forEach(event => {
      event.tags?.forEach(tag => tagSet.add(tag))
    })
    todos.forEach(todo => {
      todo.tags?.forEach(tag => tagSet.add(tag))
    })
    choreTemplates.forEach(template => {
      template.tags?.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet)
  }, [events, todos, choreTemplates])

  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    todos.forEach(todo => categorySet.add(todo.category))
    choreTemplates.forEach(template => categorySet.add(template.category))
    return Array.from(categorySet)
  }, [todos, choreTemplates])


  const handleCreateEventFromTemplate = (template: ChoreTemplate) => {
    const eventData: Partial<EnhancedCalendarEvent> = {
      title: template.name,
      description: template.description,
      start: template.nextDue || new Date(),
      end: new Date((template.nextDue || new Date()).getTime() + template.estimatedDuration * 60000),
      allDay: false,
      tags: template.tags,
      energyLevel: template.energyLevel,
      importance: template.priority === 'high' ? 4 : template.priority === 'medium' ? 3 : 2,
      workType: 'personal',
      checklist: template.instructions ? [
        { id: '1', text: template.instructions, completed: false, createdAt: new Date() }
      ] : []
    }
    setEvents(prev => [...prev, eventData as EnhancedCalendarEvent])
    setIsEditorOpen(false)
  }

  const exportToICS = () => {
    const icsContent = generateICSContent(events)
    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({
      title: "Calendar Exported",
      description: "Your calendar has been exported as an ICS file.",
    })
  }

  const generateICSContent = (events: EnhancedCalendarEvent[]): string => {
    // Helper to clean text for ICS format
    const cleanICS = (text: string): string => {
      return text
        .replace(/\\/g, '')          // Remove backslashes completely
        .replace(/[\r\n]+/g, ' ')   // Replace line breaks with spaces
        .replace(/\s+/g, ' ')        // Collapse multiple spaces
        .trim()                       // Remove leading/trailing spaces
    }

    // Build comprehensive description with all event info
    const buildDescription = (event: EnhancedCalendarEvent): string => {
      const parts: string[] = []
      
      // Original description with URL parsing
      if (event.description) {
        parts.push(event.description)
        
        // Try to extract info from URLs
        const urlRegex = /https?:\/\/[^\s]+/g
        const urls = event.description.match(urlRegex)
        if (urls) {
          urls.forEach(url => {
            try {
              const urlObj = new URL(url)
              const pathname = urlObj.pathname
              const searchParams = urlObj.searchParams
              
              // Extract parts from path (e.g., /room/id/d7857 or /CTMAT3)
              const pathParts = pathname.split('/').filter(p => p)
              
              // Look for interesting info
              const info: string[] = []
              
              // Check for room/course codes in path
              pathParts.forEach(part => {
                if (/^[A-Z]{2,}[0-9]+/.test(part)) {  // Matches CTMAT3, SA1006, etc
                  info.push(`Course/Room: ${part}`)
                } else if (part.length > 2 && part.toUpperCase() === part && /[A-Z]/.test(part)) {
                  info.push(`Code: ${part}`)
                }
              })
              
              // Check search params
              searchParams.forEach((value, key) => {
                if (key && value) {
                  info.push(`${key}: ${value}`)
                }
              })
              
              if (info.length > 0) {
                parts.push('')
                parts.push('URL Info:')
                info.forEach(i => parts.push(`- ${i}`))
              }
            } catch (e) {
              // Invalid URL, skip
            }
          })
        }
        
        parts.push('')  // Empty line
      }
      
      // Location
      if (event.location) {
        parts.push(`Location: ${event.location}`)
      }
      
      // Tags
      if (event.tags && event.tags.length > 0) {
        parts.push(`Tags: ${event.tags.join(', ')}`)
      }
      
      // Energy level
      if (event.energyLevel) {
        parts.push(`Energy Level: ${event.energyLevel}/5`)
      }
      
      // Importance
      if (event.importance) {
        parts.push(`Importance: ${event.importance}/5`)
      }
      
      // Work type
      if (event.workType) {
        parts.push(`Work Type: ${event.workType}`)
      }
      
      // Checklist
      if (event.checklist && event.checklist.length > 0) {
        parts.push('')
        parts.push('Checklist:')
        event.checklist.forEach((item, i) => {
          parts.push(`${i + 1}. ${item.text}`)
        })
      }
      
      // Reminders
      if (event.reminders && event.reminders.length > 0) {
        parts.push('')
        parts.push('Reminders:')
        event.reminders.forEach(r => {
          parts.push(`- ${r.time} minutes before`)
        })
      }
      
      return cleanICS(parts.join('\n'))
    }

    let ics = ''
    ics += 'BEGIN:VCALENDAR\n'
    ics += 'VERSION:2.0\n'
    ics += 'PRODID:-//Studyverse Garden//Calendar//EN\n'
    ics += 'CALSCALE:GREGORIAN\n'
    ics += 'METHOD:PUBLISH\n'

    events.forEach(event => {
      ics += 'BEGIN:VEVENT\n'
      ics += `UID:${event.id}@studyversegarden.com\n`
      ics += `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}\n`
      ics += `DTSTART:${format(event.start, "yyyyMMdd'T'HHmmss'Z'")}\n`
      ics += `DTEND:${format(event.end, "yyyyMMdd'T'HHmmss'Z'")}\n`
      ics += `SUMMARY:${cleanICS(event.title || '')}\n`
      
      // Add comprehensive description
      const description = buildDescription(event)
      if (description) {
        ics += `DESCRIPTION:${description}\n`
      }
      
      if (event.location) {
        ics += `LOCATION:${cleanICS(event.location)}\n`
      }
      
      if (event.tags && event.tags.length > 0) {
        ics += `CATEGORIES:${event.tags.map(t => cleanICS(t)).join(',')}\n`
      }
      
      ics += 'END:VEVENT\n'
    })

    ics += 'END:VCALENDAR\n'
    return ics
  }

  const exportData = () => {
    exportToICS()
  }

  const createDiaryEvent = async () => {
    try {
      const now = new Date()
      const [hh, mm] = (diaryTime || '21:00').split(':').map((n) => Number(n))
      const start = new Date(now)
      start.setHours(Math.max(0, Math.min(23, hh || 21)), Math.max(0, Math.min(59, mm || 0)), 0, 0)
      const end = new Date(start.getTime() + 30 * 60000)
      const newEvent: EnhancedCalendarEvent = {
        id: `event-${Date.now()}`,
        title: 'Diary',
        description: diaryPrompt || '',
        start,
        end,
        allDay: false,
        tags: ['diary'],
        workType: 'personal',
        recurrence: { type: 'daily' },
        energyLevel: 1,
        importance: 2,
      } as EnhancedCalendarEvent
      setEvents(prev => [...prev, newEvent])
      if (userId) {
        try { await supabase.from('calendar_events').upsert(eventToRow(newEvent, userId)) } catch {}
      }
      toast({ title: 'Diary created', description: `Daily prompt scheduled at ${diaryTime}.` })
    } catch (e) {
      console.warn('Failed to create diary event', e)
      toast({ title: 'Failed to create diary', description: 'Please try again', variant: 'destructive' })
    }
  }

  const importData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          
          if (data.version && data.events) {
            setEvents(ensureEventDates(data.events))
            
            if (data.todos) {
              setTodos(data.todos.map((todo: any) => ({
                ...todo,
                dueDate: todo.dueDate ? new Date(todo.dueDate) : undefined,
                createdAt: new Date(todo.createdAt),
                updatedAt: new Date(todo.updatedAt)
              })))
            }
            
            if (data.choreTemplates) {
              setChoreTemplates(data.choreTemplates.map((template: any) => ({
                ...template,
                lastCompleted: template.lastCompleted ? new Date(template.lastCompleted) : undefined,
                nextDue: template.nextDue ? new Date(template.nextDue) : undefined,
                createdAt: new Date(template.createdAt),
                updatedAt: new Date(template.updatedAt)
              })))
            }
            
            if (data.choreSchedules) {
              setChoreSchedules(data.choreSchedules.map((schedule: any) => ({
                ...schedule,
                scheduledDate: new Date(schedule.scheduledDate)
              })))
            }

            toast({
              title: "Data Imported",
              description: "Your calendar data has been imported successfully.",
            })
          } else {
            throw new Error('Invalid file format')
          }
        } catch (error) {
          toast({
            title: "Import Failed",
            description: "The file format is invalid. Please select a valid export file.",
            variant: "destructive"
          })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleHeaderImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Keep GIFs as-is to preserve animation
    if (/gif/i.test(file.type)) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setHeaderImage(dataUrl)
        try { localStorage.setItem('calendar_header_image', dataUrl) } catch {}
      }
      reader.readAsDataURL(file)
      return
    }
    try {
      const { compressImageFileToDataUrl } = await import('@/lib/image-utils')
      const dataUrl = await compressImageFileToDataUrl(file, { maxWidth: 1600, maxHeight: 400, quality: 0.85, mime: 'image/jpeg' })
      setHeaderImage(dataUrl)
      try { localStorage.setItem('calendar_header_image', dataUrl) } catch {}
    } catch {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setHeaderImage(dataUrl)
        try { localStorage.setItem('calendar_header_image', dataUrl) } catch {}
      }
      reader.readAsDataURL(file)
    }
  }

  // Export calendar as URL
  const exportToUrl = () => {
    const data = {
      version: 1,
      events,
      todos,
      choreTemplates,
      choreSchedules
    }
    const encoded = encodeURIComponent(btoa(JSON.stringify(data)))
    const shareableUrl = `${window.location.origin}/calendar?import=${encoded}`
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareableUrl)
    toast({
      title: 'Shareable URL Created',
      description: 'Your calendar has been exported as a shareable URL and copied to clipboard. Anyone with this link can import your calendar.',
    })
  }

  // Delete all imported events
  const deleteImportedEvents = async () => {
    const importedEvents = events.filter(e => e.tags?.includes('imported'))
    if (importedEvents.length === 0) {
      toast({
        title: 'No Imported Events',
        description: 'There are no imported events to delete.',
      })
      return
    }

    const remainingEvents = events.filter(e => !e.tags?.includes('imported'))
    setEvents(remainingEvents)

    // Delete from Supabase if user is logged in
    if (userId) {
      for (const event of importedEvents) {
        try {
          await supabase.from('calendar_events').delete().eq('id', event.id).eq('user_id', userId)
        } catch (error) {
          console.error('Error deleting imported event:', error)
        }
      }
    }

    toast({
      title: 'Imported Events Deleted',
      description: `Deleted ${importedEvents.length} imported event(s).`,
    })
  }

  // Delete all events today and forward
  const deleteFutureEvents = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    const futureEvents = events.filter(e => e.start >= today)
    if (futureEvents.length === 0) {
      toast({
        title: 'No Future Events',
        description: 'There are no events today or in the future to delete.',
      })
      return
    }

    const remainingEvents = events.filter(e => e.start < today)
    setEvents(remainingEvents)

    // Delete from Supabase if user is logged in
    if (userId) {
      for (const event of futureEvents) {
        try {
          await supabase.from('calendar_events').delete().eq('id', event.id).eq('user_id', userId)
        } catch (error) {
          console.error('Error deleting future event:', error)
        }
      }
    }

    toast({
      title: 'Future Events Deleted',
      description: `Deleted ${futureEvents.length} event(s) from today onward.`,
    })
  }

  // Import calendar from URL
  const importFromUrl = async () => {
    try {
      // Check if it's an iCal URL (ends with .ics or contains icalendar)
      const isICalUrl = importUrl.includes('.ics') || importUrl.includes('icalendar') || importUrl.includes('calendar');
      
      if (isICalUrl) {
        // Handle iCal import via API route to bypass CORS
        const response = await fetch('/api/import-ical', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: importUrl }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch calendar: ${response.status} ${response.statusText}`);
        }
        
        const { events: parsedEvents } = await response.json();
        
        if (parsedEvents.length === 0) {
          throw new Error('No events found in the calendar feed');
        }
        
        // Convert iCal events to our format - preserve ALL fields in description
        const convertedEvents = parsedEvents.map((event: any, index: number) => {
          // Build comprehensive description with all imported fields
          const descParts: string[] = []
          
          // Original description
          if (event.description) {
            descParts.push(event.description)
            descParts.push('')
          }
          
          // Add ALL extra fields from the imported event
          const extraFields: string[] = []
          
          // Common ICS fields that might have extra info
          if (event.organizer) extraFields.push(`Organizer: ${event.organizer}`)
          if (event.attendees && event.attendees.length > 0) {
            extraFields.push(`Attendees: ${event.attendees.join(', ')}`)
          }
          if (event.categories && event.categories.length > 0) {
            extraFields.push(`Categories: ${event.categories.join(', ')}`)
          }
          if (event.status) extraFields.push(`Status: ${event.status}`)
          if (event.class) extraFields.push(`Class: ${event.class}`)
          if (event.priority) extraFields.push(`Priority: ${event.priority}`)
          if (event.resources && event.resources.length > 0) {
            extraFields.push(`Resources: ${event.resources.join(', ')}`)
          }
          if (event.url) extraFields.push(`URL: ${event.url}`)
          
          // Add any custom fields (X-properties) and other unknown fields
          Object.keys(event).forEach(key => {
            // Skip the fields we've already shown
            const skipFields = ['summary', 'description', 'start', 'end', 'allDay', 'location', 
                               'organizer', 'attendees', 'categories', 'status', 'class', 
                               'priority', 'resources', 'url', 'teacher', 'professor', 
                               'instructor', 'course', 'courseCode', 'year', 'group']
            
            // Skip technical ICS metadata
            const technicalFields = ['uid', 'dtstamp', 'last-modified', 'created', 'sequence', 'transp']
            
            if (!skipFields.includes(key) && !technicalFields.includes(key) && event[key]) {
              const value = Array.isArray(event[key]) ? event[key].join(', ') : event[key]
              if (value && value.toString().trim()) {
                extraFields.push(`${key}: ${value}`)
              }
            }
          })
          
          // Look for teacher/professor field (common names)
          if (event.teacher) extraFields.push(`Teacher: ${event.teacher}`)
          if (event.professor) extraFields.push(`Professor: ${event.professor}`)
          if (event.instructor) extraFields.push(`Instructor: ${event.instructor}`)
          
          // Look for class/year/course fields
          if (event.course) extraFields.push(`Course: ${event.course}`)
          if (event.courseCode) extraFields.push(`Course Code: ${event.courseCode}`)
          if (event.year) extraFields.push(`Year: ${event.year}`)
          if (event.group) extraFields.push(`Group: ${event.group}`)
          
          // Extract course codes from description if present (e.g., CTMAT3, CTFYS2)
          if (event.description) {
            const courseCodeRegex = /\b([A-Z]{2,}[0-9]+)\b/g
            const matches = event.description.match(courseCodeRegex)
            if (matches && matches.length > 0) {
              const uniqueCodes = [...new Set(matches)]
              extraFields.push(`Course Codes: ${uniqueCodes.join(', ')}`)
            }
          }
          
          if (extraFields.length > 0) {
            descParts.push('Additional Information:')
            extraFields.forEach(field => descParts.push(`• ${field}`))
          }
          
          return {
            id: `imported-${Date.now()}-${index}`,
            title: event.summary || 'Untitled Event',
            description: descParts.join('\n'),
            start: new Date(event.start),
            end: new Date(event.end),
            allDay: event.allDay || false,
            location: event.location,
            tags: ['imported'],
            energyLevel: 3 as const,
            importance: 3,
            workType: 'shallow' as const,
            checklist: [],
            reminders: []
          }
        }) as EnhancedCalendarEvent[];
        
        setEvents(prev => [...prev, ...convertedEvents]);
        toast({
          title: 'iCal Calendar Imported',
          description: `Successfully imported ${convertedEvents.length} events from the calendar feed.`
        });
      } else {
        // Handle our custom URL format
        const url = new URL(importUrl);
        const encoded = url.searchParams.get('import');
        if (!encoded) throw new Error('No import data found in URL');
        const data = JSON.parse(atob(decodeURIComponent(encoded)));
        if (data.version && data.events) {
          setEvents(ensureEventDates(data.events))
          if (data.todos) {
            setTodos(data.todos.map((todo: any) => ({
              ...todo,
              dueDate: todo.dueDate ? new Date(todo.dueDate) : undefined,
              createdAt: new Date(todo.createdAt),
              updatedAt: new Date(todo.updatedAt)
            })))
          }
          if (data.choreTemplates) {
            setChoreTemplates(data.choreTemplates.map((template: any) => ({
              ...template,
              lastCompleted: template.lastCompleted ? new Date(template.lastCompleted) : undefined,
              nextDue: template.nextDue ? new Date(template.nextDue) : undefined,
              createdAt: new Date(template.createdAt),
              updatedAt: new Date(template.updatedAt)
            })))
          }
          if (data.choreSchedules) {
            setChoreSchedules(data.choreSchedules.map((schedule: any) => ({
              ...schedule,
              scheduledDate: new Date(schedule.scheduledDate)
            })))
          }
          toast({
            title: 'Calendar Imported',
            description: 'Calendar data imported from URL.'
          });
        } else {
          throw new Error('Invalid data format');
        }
      }
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Load saved header image and transform
  useEffect(() => {
    try {
      const saved = localStorage.getItem('calendar_header_image') || localStorage.getItem('calendar_banner_image')
      if (saved) setHeaderImage(saved)
      const tRaw = localStorage.getItem('calendar_header_transform')
      if (tRaw) {
        const t = JSON.parse(tRaw)
        if (typeof t.scale === 'number') setBannerScale(Math.max(0.5, Math.min(3, t.scale)))
        if (typeof t.x === 'number' && typeof t.y === 'number') setBannerPos({ x: Math.max(0, Math.min(100, t.x)), y: Math.max(0, Math.min(100, t.y)) })
      }
    } catch {}
  }, [])
  // Persist transform
  useEffect(() => {
    try { localStorage.setItem('calendar_header_transform', JSON.stringify({ scale: bannerScale, x: bannerPos.x, y: bannerPos.y })) } catch {}
  }, [bannerScale, bannerPos])

  // Load events from Supabase if logged in; otherwise redirect to login
  useEffect(() => {
    let mounted = true
    ;(async () => {
      // Schema preflight to surface missing columns early
      const issues = await runSchemaPreflight()
      if (issues.length > 0) {
        console.warn('Schema preflight issues:', issues)
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        // Not logged in; route to login page
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return
      }
      const uid = data.session.user.id
      if (!mounted) return
      setUserId(uid)
      // Fetch events for this user
      const { data: rows, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', uid)
        .order('start', { ascending: true })
      if (!mounted) return
      if (error) {
        // Just warn, keep local state
        // eslint-disable-next-line no-console
        console.warn('Failed to load events from Supabase', error.message)
      } else if (rows) {
        const loaded = rows.map(rowToEvent)
        setEvents(prev => mergeEventsById(prev, ensureEventDates(loaded)))
      }
    })()

    // Also react to auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (typeof window !== 'undefined') window.location.href = '/login'
      } else {
        setUserId(session.user.id)
      }
    })
    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  // Supabase Realtime: listen for calendar_events changes and merge into local state
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('calendar_events_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          try {
            if (payload.eventType === 'DELETE') {
              const id = payload?.old?.id
              if (!id) return
              setEvents(prev => prev.filter(e => e.id !== id))
              return
            }
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload?.new
              if (!row) return
              const ev = rowToEvent(row)
              // ensure dates
              const hydrated = ensureEventDates([ev])
              setEvents(prev => mergeEventsById(prev, hydrated))
            }
          } catch {}
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [userId])

  // Auto-import if ?import= is present in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const encoded = params.get('import')
      if (encoded) {
        try {
          const data = JSON.parse(atob(decodeURIComponent(encoded)))
          if (data.version && data.events) {
            setEvents(ensureEventDates(data.events))
            if (data.todos) {
              setTodos(data.todos.map((todo: any) => ({
                ...todo,
                dueDate: todo.dueDate ? new Date(todo.dueDate) : undefined,
                createdAt: new Date(todo.createdAt),
                updatedAt: new Date(todo.updatedAt)
              })))
            }
            if (data.choreTemplates) {
              setChoreTemplates(data.choreTemplates.map((template: any) => ({
                ...template,
                lastCompleted: template.lastCompleted ? new Date(template.lastCompleted) : undefined,
                nextDue: template.nextDue ? new Date(template.nextDue) : undefined,
                createdAt: new Date(template.createdAt),
                updatedAt: new Date(template.updatedAt)
              })))
            }
            if (data.choreSchedules) {
              setChoreSchedules(data.choreSchedules.map((schedule: any) => ({
                ...schedule,
                scheduledDate: new Date(schedule.scheduledDate)
              })))
            }
            toast({
              title: 'Calendar Imported',
              description: 'Calendar data imported from URL.'
            })
          }
        } catch {}
      }
    }
  }, [])

  // Toggle example data
  const toggleExampleData = useCallback(() => {
    if (!exampleDataActive) {
      setEvents(prev => [...prev, ...exampleEvents]);
      setTodos(prev => [...prev, ...exampleTodos]);
      setChoreTemplates(prev => [...prev, ...exampleChoreTemplates]);
      setExampleDataActive(true);
      setCurrentDate(exampleEvents[0].start);
      toast({ title: 'Example Data Added', description: 'Demo events, todos, and chores have been added.' });
    } else {
      setEvents(prev => prev.filter(e => !e.tags?.includes('example')));
      setTodos(prev => prev.filter(t => !t.tags?.includes('example')));
      setChoreTemplates(prev => prev.filter(c => !c.tags?.includes('example')));
      setExampleDataActive(false);
      toast({ title: 'Example Data Removed', description: 'Demo data has been removed.' });
    }
  }, [exampleDataActive]);

  const headerHidden = useHideOnScroll();

  const [exportModalOpen, setExportModalOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Optional Header Image/GIF */}
      <div className={`relative h-48 bg-forest-gradient overflow-hidden flex items-center justify-center transition-transform duration-300 ${headerHidden ? '-translate-y-full opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {headerImage ? (
          <img
            src={headerImage}
            alt="Header"
            className="absolute inset-0 w-full h-full object-cover opacity-80 select-none"
            style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%`, transform: `scale(${bannerScale})`, transformOrigin: 'center' }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-lg italic opacity-60">
            Add a header image or GIF for inspiration
          </div>
        )}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Upload Header Image/GIF
          </Button>
          {headerImage && (
            <Button variant="outline" size="sm" onClick={() => setIsBannerEditorOpen(true)}>
              Edit Banner
            </Button>
          )}
          <input
            type="file"
            accept="image/*,image/gif"
            ref={fileInputRef}
            className="hidden"
            onChange={handleHeaderImageChange}
          />
        </div>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Banner Editor */}
      <Dialog open={isBannerEditorOpen} onOpenChange={setIsBannerEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit header banner</DialogTitle>
            <DialogDescription>Pan and zoom to fit your photo or GIF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="w-full border rounded-lg overflow-hidden bg-black/10" style={{ aspectRatio: '4 / 1' }}>
              {headerImage && (
                <img
                  src={headerImage}
                  alt="Banner preview"
                  className="w-full h-full object-cover select-none"
                  style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%`, transform: `scale(${bannerScale})`, transformOrigin: 'center' }}
                  draggable={false}
                />
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <div className="text-sm font-medium mb-2">Zoom</div>
                <Slider value={[bannerScale]} min={0.5} max={3} step={0.05} onValueChange={([v]) => setBannerScale(v)} />
                <div className="text-xs text-muted-foreground mt-1">{Math.round(bannerScale * 100)}%</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Horizontal</div>
                <Slider value={[bannerPos.x]} min={0} max={100} step={1} onValueChange={([v]) => setBannerPos(p => ({ ...p, x: v }))} />
                <div className="text-xs text-muted-foreground mt-1">{Math.round(bannerPos.x)}%</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Vertical</div>
                <Slider value={[bannerPos.y]} min={0} max={100} step={1} onValueChange={([v]) => setBannerPos(p => ({ ...p, y: v }))} />
                <div className="text-xs text-muted-foreground mt-1">{Math.round(bannerPos.y)}%</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBannerScale(1); setBannerPos({ x: 50, y: 50 }); }}>Reset</Button>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diary Modal */}
      <Dialog open={diaryOpen} onOpenChange={setDiaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Daily Diary Prompt</DialogTitle>
            <DialogDescription>Schedule a repeating daily prompt at your chosen time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt</label>
              <input className="w-full border rounded px-2 py-1 text-sm" value={diaryPrompt} onChange={e=>setDiaryPrompt(e.target.value)} placeholder="Something positive today was..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <input className="border rounded px-2 py-1 text-sm" type="time" value={diaryTime} onChange={e=>setDiaryTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={createDiaryEvent}>Create</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title="Calendar"
        description="Manage your schedule, habits, and tasks"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={toggleExampleData}>
              {exampleDataActive ? 'Remove Example Data' : 'Add Example Data'}
            </Button>
            <Button variant="outline" onClick={() => setDiaryOpen(true)}>Diary</Button>
            <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Calendar</DialogTitle>
                  <DialogDescription>
                    Choose how you want to export your calendar data.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Button variant="outline" onClick={() => { exportToICS(); setExportModalOpen(false); }}>
                    Export as File (.ics)
                  </Button>
                  <Button variant="outline" onClick={() => { exportToUrl(); setExportModalOpen(false); }}>
                    Export as Shareable URL
                  </Button>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Calendar</DialogTitle>
                  <DialogDescription>
                    Import your calendar from a file or URL
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Import from File</h4>
                    <Button variant="outline" onClick={() => {
                      importData()
                      setImportModalOpen(false)
                    }}>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Import from URL</h4>
                    <div className="space-y-2">
                      <input
                        ref={importUrlInputRef}
                        type="text"
                        placeholder="Paste calendar import URL here"
                        value={importUrl}
                        onChange={e => setImportUrl(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                      <Button variant="outline" onClick={() => {
                        importFromUrl()
                        setImportModalOpen(false)
                      }}>
                        Import from URL
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2 text-destructive">Danger Zone</h4>
                    <div className="space-y-2">
                      <Button 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => {
                          deleteImportedEvents()
                          setImportModalOpen(false)
                        }}
                      >
                        Delete All Imported Events
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => {
                          if (confirm('Are you sure? This will delete ALL events from today forward!')) {
                            deleteFutureEvents()
                            setImportModalOpen(false)
                          }
                        }}
                      >
                        Delete Everything Today & Forward
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />


      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="calendar" className="h-full flex flex-col">
          <TabsList className="mx-4 mb-4">
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="habits" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Habits
            </TabsTrigger>
            <TabsTrigger value="chores" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Chore Templates
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto px-4">
            <TabsContent value="calendar" className="space-y-4 mt-0">
              {warnings.length > 0 && (
                <div className="border rounded-md bg-amber-50/60 text-amber-900 p-3">
                  <div className="font-medium mb-1">Study warnings</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </div>
              )}
              {/* Calendar Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
                    <Button 
                      size="sm" 
                      variant={view === 'day' ? 'secondary' : 'ghost'}
                      onClick={() => setView('day')}
                      className={view === 'day' ? 'font-bold border border-primary bg-primary/10 text-primary' : ''}
                    >
                      Day
                    </Button>
                    <Button 
                      size="sm" 
                      variant={view === 'week' ? 'secondary' : 'ghost'}
                      onClick={() => setView('week')}
                      className={view === 'week' ? 'font-bold border border-primary bg-primary/10 text-primary' : ''}
                    >
                      Week
                    </Button>
                    <Button 
                      size="sm" 
                      variant={view === 'month' ? 'secondary' : 'ghost'}
                      onClick={() => setView('month')}
                      className={view === 'month' ? 'font-bold border border-primary bg-primary/10 text-primary' : ''}
                    >
                      Month
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
                      ←
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentDate(new Date())}
                    >
                      Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
                      →
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Hours</span>
                    <select
                      className="border rounded px-1 py-1 bg-background"
                      value={minHour}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setMinHour(v)
                        if (v > maxHour) setMaxHour(v)
                      }}
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map(h => (
                        <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                      ))}
                    </select>
                    <span>-</span>
                    <select
                      className="border rounded px-1 py-1 bg-background"
                      value={maxHour}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setMaxHour(v)
                        if (v < minHour) setMinHour(v)
                      }}
                    >
                      {Array.from({ length: 24 - minHour }, (_, i) => minHour + i).map(h => (
                        <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-lg font-semibold">
                    {format(currentDate, 'MMMM yyyy')}
                  </div>
                </div>
              </div>

              {/* Calendar View */}
              <div className="border rounded-lg min-h-[500px]">
                {view === 'week' && (
                  <WeekView
                    currentDate={currentDate}
                    events={eventsInRange}
                    onEventClick={handleEventClick}
                    onCreateEvent={handleTimeSlotClick}
                    onDateClick={(date) => setCurrentDate(date)}
                    minHour={minHour}
                    maxHour={maxHour}
                  />
                )}

                {view === 'day' && (
                  <DayView
                    currentDate={currentDate}
                    events={eventsInRange}
                    onEventClick={handleEventClick}
                    onCreateEvent={handleTimeSlotClick}
                    minHour={minHour}
                    maxHour={maxHour}
                  />
                )}

                {view === 'month' && (
                  <MonthView
                    currentDate={currentDate}
                    events={eventsInRange}
                    onDateClick={(date) => {
                      setCurrentDate(date)
                      setView('day')
                    }}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="habits" className="mt-0">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Habit Tracking</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {allTags.filter(tag => 
                      events.some(e => e.isHabit && e.tags?.includes(tag))
                    ).length === 0 ? (
                      // Example habits if none exist
                      <>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4" />
                            <span className="font-medium">Drink Water</span>
                            <Badge variant="secondary">5🔥</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">5 times this week</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4" />
                            <span className="font-medium">Morning Walk</span>
                            <Badge variant="secondary">3🔥</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">3 times this week</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4" />
                            <span className="font-medium">Read 10 Pages</span>
                            <Badge variant="secondary">7🔥</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">7 times this week</div>
                        </div>
                      </>
                    ) : (
                      allTags.filter(tag => 
                        events.some(e => e.isHabit && e.tags?.includes(tag))
                      ).map(habitTag => {
                        const habitEvents = events.filter(e => 
                          e.isHabit && e.tags?.includes(habitTag)
                        )
                        const completedThisWeek = habitEvents.filter(e => 
                          e.completed && e.start >= weekStart && e.start <= weekEnd
                        ).length
                        const maxStreak = Math.max(...habitEvents.map(e => e.habitStreak || 0))

                        return (
                          <div key={habitTag} className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-4 w-4" />
                              <span className="font-medium">{habitTag}</span>
                              {maxStreak > 0 && (
                                <Badge variant="secondary">{maxStreak}🔥</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {completedThisWeek} times this week
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chores" className="mt-0">
              <ChoreTemplates 
                templates={choreTemplates}
                onTemplatesChange={handleChoreTemplatesChange}
                schedules={choreSchedules}
                onSchedulesChange={handleChoreSchedulesChange}
                categories={categories}
                allTags={allTags}
                onCreateEventFromTemplate={handleCreateEventFromTemplate}
              />
            </TabsContent>

            
          </div>
        </Tabs>
      </div>

      {/* Event Editor */}
      {isEditorOpen && (
        <EnhancedEventEditor
          isOpen={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          onSave={handleSaveEvent}
          event={selectedEvent || undefined}
          defaultDate={editorDefaults.date}
          defaultTime={editorDefaults.time}
          allTags={allTags}
        />
      )}

      {/* Event Details */}
      {selectedEvent && (
        <EnhancedEventDisplay
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEventEdit}
          onDelete={handleEventDelete}
onUpdate={(updatedEvent) => {
                      // Validate before accepting updates from the display
                      if (!isValidDateValue(updatedEvent.start) || !isValidDateValue(updatedEvent.end)) {
                        toast({ title: 'Invalid time', description: 'Update ignored because time is empty/invalid.', variant: 'destructive' });
                        return;
                      }
                      setEvents(prev => prev.map(e => 
                        e.id === updatedEvent.id ? ({ ...e, ...updatedEvent } as any) : e
                      ))
                      setSelectedEvent(prev => (prev ? ({ ...prev, ...updatedEvent } as any) : prev))
                    }}        />
      )}
    </div>
  )
}
