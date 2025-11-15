"use client"

import { useState, useEffect, useMemo, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LeafIcon } from '@/components/icons/leaf-icon'
import { studyAdvisor, type AIAdvice } from '@/ai/flows/study-advisor'
import { notificationService } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DatabaseService from '@/lib/database'
import { supabase } from '@/lib/supabaseClient'
import { 
  BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, LineChart as RLineChart, Line, Legend, PieChart as RPieChart, Pie, Cell
} from 'recharts'

interface StudyData {
  totalStudyTime: number
  averageSessionLength: number
  productivityTrend: number
  burnoutRisk: number
  subjectPerformance: Record<string, number>
  studyStreak: number
  weeklyGoals: number
  weeklyAchievements: number
  dailyStudyHours: number[]
  subjectBreakdown: Record<string, number>
}

// --- CSV Trends helpers ---
interface StudyCsvRow { [k: string]: any }
function parseStudyCSV(text: string): StudyCsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length <= 1) return []
  const headers = lines[0].split(',').map(h=>h.trim())
  const out: StudyCsvRow[] = []
  for (let i=1;i<lines.length;i++){
    const line = lines[i]; if (!line) continue
    const cells: string[] = []; let cur=''; let inQ=false
    for (let j=0;j<line.length;j++){
      const ch=line[j]
      if (inQ){ if (ch==='"'){ if (j+1<line.length && line[j+1]==='"'){ cur+='"'; j++ } else { inQ=false } } else { cur+=ch } }
      else { if (ch==='"') inQ=true; else if (ch===','){ cells.push(cur); cur='' } else cur+=ch }
    }
    cells.push(cur)
    const rec: any = {}; headers.forEach((h, idx)=> rec[h] = (cells[idx] ?? '').trim())
    // Normalize numeric fields
    const numFields = ['duration_minutes','duration_seconds','energy_before','happiness','energy_after','hardness','forest_trees']
    numFields.forEach(f => { if (f in rec) rec[f] = rec[f] === '' ? NaN : Number(rec[f]) })
    out.push(rec)
  }
  return out
}
function mean(vals: number[]) { const arr = vals.filter(v=>Number.isFinite(v)); return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0 }
function pearson(x: number[], y: number[]) {
  const pairs: [number, number][] = []
  const n = Math.min(x.length, y.length)
  for (let i = 0; i < n; i++) {
    const xi = x[i]
    const yi = y[i]
    if (Number.isFinite(xi) && Number.isFinite(yi)) {
      pairs.push([Number(xi), Number(yi)])
    }
  }
  if (!pairs.length) return 0
  const xs = pairs.map(p => p[0])
  const ys = pairs.map(p => p[1])
  const mX = mean(xs), mY = mean(ys)
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < pairs.length; i++) {
    const dx = xs[i] - mX
    const dy = ys[i] - mY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den ? num / den : 0
}
function buildExampleCsv(): string {
  const header = 'date,started_at,ended_at,user_id,subject,subject_id,duration_minutes,duration_seconds,energy_before,goal,goal_achievement,happiness,energy_after,breaks,used_solutions,hardness,next_plan,forest_trees' + '\r\n'
  
  // Generate 3 months of comprehensive study data (90 days with 2-3 sessions per day)
  const rows: any[] = []
  const subjects = [
    {name: 'Math', id: 's1', goals: ['review LA', 'old exam', 'problem set', 'mock exam', 'integration', 'derivatives']},
    {name: 'Physics', id: 's2', goals: ['hw set', 'lab prep', 'problem set', 'mechanics', 'thermodynamics', 'optics']},
    {name: 'Chemistry', id: 's3', goals: ['notes', 'reactions', 'lab report', 'organic chem', 'stoichiometry']},
    {name: 'English', id: 's4', goals: ['essay', 'reading', 'analysis', 'grammar', 'literature review']},
    {name: 'Biology', id: 's5', goals: ['lab prep', 'flashcards', 'genetics', 'ecology', 'cell biology']},
    {name: 'History', id: 's6', goals: ['timeline', 'essay prep', 'primary sources', 'world war study']},
  ]
  
  // Use last 3 months ending today for example data
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setDate(endDate.getDate() - 90)
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    // Skip some Sundays (rest days)
    if (dayOfWeek === 0 && Math.random() > 0.3) continue
    
    // 2-4 sessions per day with variation
    const numSessions = dayOfWeek === 6 ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 3) + 2
    
    for (let s = 0; s < numSessions; s++) {
      const subject = subjects[Math.floor(Math.random() * subjects.length)]
      const duration = [30, 45, 60, 75, 90, 120][Math.floor(Math.random() * 6)]
      const hour = s === 0 ? 7 + Math.floor(Math.random() * 3) : 
                   s === 1 ? 13 + Math.floor(Math.random() * 3) :
                   s === 2 ? 18 + Math.floor(Math.random() * 4) : 9 + Math.floor(Math.random() * 12)
      
      const startTime = new Date(d)
      startTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0)
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + duration)
      
      const energyBefore = Math.floor(Math.random() * 3) + 2 // 2-4
      const energyAfter = Math.max(1, Math.min(5, energyBefore + (Math.floor(Math.random() * 3) - 1))) // ±1
      const happiness = Math.floor(Math.random() * 3) + 2 // 2-4
      const hardness = Math.floor(Math.random() * 4) + 1 // 1-4
      const goalAchievement = Math.random() < 0.7 ? (Math.random() < 0.5 ? 1 : 0.5) : 0
      const usedSolutions = Math.random() < 0.3 ? 'yes' : 'no'
      const forestTrees = Math.floor(Math.random() * 5) + 2 // 2-6
      const goal = subject.goals[Math.floor(Math.random() * subject.goals.length)]
      
      // Generate realistic breaks
      const breakTypes = ['drink water', 'snack', 'walk', 'stretch', 'phone scroll', 'social media', 'music', 'nap', 'coffee', 'tea']
      const numBreaks = duration >= 60 ? Math.floor(Math.random() * 3) + 1 : (Math.random() < 0.5 ? 1 : 0)
      const breaks = numBreaks > 0 ? Array.from({length: numBreaks}, () => breakTypes[Math.floor(Math.random() * breakTypes.length)]).join(';') : ''
      
      rows.push([
        d.toISOString().split('T')[0],
        startTime.toISOString(),
        endTime.toISOString(),
        'u1',
        subject.name,
        subject.id,
        duration,
        duration * 60,
        energyBefore,
        goal,
        goalAchievement,
        happiness,
        energyAfter,
        breaks,
        usedSolutions,
        hardness,
        'continue studying',
        forestTrees
      ])
    }
  }
  
  const esc = (v:any)=>{ const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s }
  return header + rows.map(r=> r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export default function AnalyticsPage() {
  const [studyData, setStudyData] = useState<StudyData | null>(null)
  const [aiAdvice, setAiAdvice] = useState<AIAdvice[]>([])
  const [burnoutWarning, setBurnoutWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [focusAid, setFocusAid] = useState<'start'|'continue'|'end'|null>(null)

  // Trends (CSV-based)
  const [csvText, setCsvText] = useState<string>('')
  const [useExample, setUseExample] = useState(false)
  // Trends controls
  const [selectedSubject, setSelectedSubject] = useState<string>('All')
  const [energyMetric, setEnergyMetric] = useState<'energy_before' | 'energy_after'>('energy_before')
  const [calendarEvents, setCalendarEvents] = useState<{ id?: string; start: Date; end?: Date; energyLevel?: number; tags?: string[]; workType?: string; moodAfter?: number; goalAchievement?: number; title?: string; description?: string; recurrence?: any }[]>([])
  const [subjectAvgs, setSubjectAvgs] = useState<{ subject: string; avgConfidence: number; avgImportance: number }[]>([])
  const [subjectVocabMap, setSubjectVocabMap] = useState<Record<string, { concept: string; confidence: number | null; importance: number | null }[]>>({})
  const [subjectNames, setSubjectNames] = useState<string[]>([])
  const [selectedVocabSubject, setSelectedVocabSubject] = useState<string>(()=>{
    try { return localStorage.getItem('analytics_selected_vocab_subject') || '' } catch { return '' }
  })
  const [includeTags, setIncludeTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('analytics_category_include_tags') || '[]') } catch { return [] }
  })
  // Date range controls
  const [rangeMode, setRangeMode] = useState<'week'|'month'|'custom'>(()=>{
    try { return (localStorage.getItem('analytics_range_mode') as any) || 'week' } catch { return 'week' }
  })
  const [customStart, setCustomStart] = useState<string>(()=>{
    try { return localStorage.getItem('analytics_range_start') || '' } catch { return '' }
  })
  const [customEnd, setCustomEnd] = useState<string>(()=>{
    try { return localStorage.getItem('analytics_range_end') || '' } catch { return '' }
  })
  // Happiness over time range
  const [happinessRange, setHappinessRange] = useState<'week'|'month'|'year'>(()=>{
    try { return (localStorage.getItem('analytics_happiness_range') as any) || 'month' } catch { return 'month' }
  })
  const [refreshKey, setRefreshKey] = useState(0)

  const refreshCsvData = () => {
    setRefreshKey(prev => prev + 1)
  }

  useEffect(()=>{
    if (useExample) { 
      setCsvText(buildExampleCsv());
      // Also populate example calendar events (last 90 days)
      const exampleEvents: any[] = []
      const now = new Date()
      const startDate = new Date(now)
      startDate.setDate(now.getDate() - 90)
      
      // Add comprehensive study events with proper tags and durations
      for (let i = 0; i < 90; i++) {
        const d = new Date(startDate)
        d.setDate(d.getDate() + i)
        const dayOfWeek = d.getDay()
        
        // Skip some Sundays (rest days)
        if (dayOfWeek === 0 && Math.random() > 0.3) continue
        
        // 2-4 study sessions per day with variation
        const numSessions = dayOfWeek === 6 ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 3) + 2
        
        for (let s = 0; s < numSessions; s++) {
          const subjects = ['Math', 'Physics', 'Chemistry', 'English', 'Biology', 'History']
          const subject = subjects[Math.floor(Math.random() * subjects.length)]
          const duration = [30, 45, 60, 75, 90, 120][Math.floor(Math.random() * 6)] * 60000 // in ms
          const hour = s === 0 ? 7 + Math.floor(Math.random() * 3) : 
                       s === 1 ? 13 + Math.floor(Math.random() * 3) :
                       s === 2 ? 18 + Math.floor(Math.random() * 4) : 9 + Math.floor(Math.random() * 12)
          
          const startTime = new Date(d)
          startTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0)
          const endTime = new Date(startTime.getTime() + duration)
          
          exampleEvents.push({
            id: `ex-study-${i}-${s}`,
            title: `${subject} Study`,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            energyLevel: Math.floor(Math.random() * 3) + 2,
            tags: ['study', subject],
            workType: 'Study',
            moodAfter: Math.floor(Math.random() * 3) + 2,
            goalAchievement: Math.random() < 0.7 ? (Math.random() < 0.5 ? 1 : 0.5) : 0,
          })
          
          // Add breaks between sessions (some sessions)
          if (Math.random() < 0.5) {
            const breakStart = new Date(endTime.getTime() + 5 * 60000) // 5 min after
            const breakDuration = [10, 15, 20, 30][Math.floor(Math.random() * 4)] * 60000
            const breakEnd = new Date(breakStart.getTime() + breakDuration)
            const breakTypes = ['drink water', 'snack', 'walk', 'stretch', 'coffee', 'tea']
            const breakType = breakTypes[Math.floor(Math.random() * breakTypes.length)]
            
            exampleEvents.push({
              id: `ex-break-${i}-${s}`,
              title: breakType,
              start: breakStart.toISOString(),
              end: breakEnd.toISOString(),
              energyLevel: Math.floor(Math.random() * 2) + 3, // 3-4
              tags: ['break'],
              workType: 'break',
              moodAfter: Math.floor(Math.random() * 2) + 3,
            })
          }
        }
        
        // Add some other activity types for category pie chart
        if (Math.random() < 0.4) {
          const activityTypes = [
            { title: 'Exercise', tags: ['health'], duration: 45 },
            { title: 'Meal prep', tags: ['chores'], duration: 30 },
            { title: 'Social time', tags: ['social'], duration: 60 },
            { title: 'Important meeting', tags: ['important'], duration: 40 },
          ]
          const activity = activityTypes[Math.floor(Math.random() * activityTypes.length)]
          const activityStart = new Date(d)
          activityStart.setHours(17 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0)
          const activityEnd = new Date(activityStart.getTime() + activity.duration * 60000)
          
          exampleEvents.push({
            id: `ex-activity-${i}`,
            title: activity.title,
            start: activityStart.toISOString(),
            end: activityEnd.toISOString(),
            energyLevel: Math.floor(Math.random() * 3) + 2,
            tags: activity.tags,
            moodAfter: Math.floor(Math.random() * 3) + 2,
          })
        }
      }
      
      // Add diary entries for throwback dates (yesterday, week ago, month ago, year ago)
      const diaryDates = [1, 7, 30, 365]
      const diaryPrompts = [
        'Feeling productive today! Finished all my study goals and even had time for a workout.',
        'Struggled with focus this morning but recovered after lunch. Chemistry is getting easier!',
        'Amazing study session at the library. Found a great study group for Physics.',
        'Feeling overwhelmed with all the exams coming up. Need to create a better schedule.',
      ]
      
      diaryDates.forEach((daysAgo, idx) => {
        const diaryDate = new Date(now)
        diaryDate.setDate(diaryDate.getDate() - daysAgo)
        diaryDate.setHours(20, 0, 0, 0) // 8 PM diary entry
        
        exampleEvents.push({
          id: `ex-diary-${daysAgo}`,
          title: 'diary',
          start: diaryDate.toISOString(),
          end: new Date(diaryDate.getTime() + 10 * 60000).toISOString(), // 10 min
          tags: ['diary'],
          description: diaryPrompts[idx % diaryPrompts.length],
        })
      })
      
      setCalendarEvents(exampleEvents.map(ev => ({
        ...ev,
        start: new Date(ev.start),
        end: ev.end ? new Date(ev.end) : undefined,
      })))
      
      // Populate example subject data
      const exampleSubjects = ['Math', 'Physics', 'Chemistry', 'English', 'Biology', 'History']
      const exampleAvgs = exampleSubjects.map(s => ({
        subject: s,
        avgConfidence: +(2 + Math.random() * 2).toFixed(2), // 2-4
        avgImportance: +(2 + Math.random() * 2).toFixed(2), // 2-4
      }))
      setSubjectAvgs(exampleAvgs)
      
      const exampleVocabMap: Record<string, any[]> = {}
      exampleSubjects.forEach(s => {
        const concepts = Array.from({ length: 20 }, (_, i) => ({
          concept: `${s} Concept ${i + 1}`,
          confidence: +(1 + Math.random() * 4).toFixed(2),
          importance: +(1 + Math.random() * 4).toFixed(2),
        }))
        exampleVocabMap[s] = concepts
      })
      setSubjectVocabMap(exampleVocabMap)
      setSubjectNames(exampleSubjects)
      if (!selectedVocabSubject) setSelectedVocabSubject('Math')
      return
    }
    try {
      const raw = localStorage.getItem('bankData')
      if (!raw) { setCsvText(''); return }
      const bank = JSON.parse(raw)
      const home = bank.find((i:any)=>i.id==='home' && i.type==='folder')
      const file = home?.items?.find((it:any)=>it.type==='file' && it.name==='study_sessions.csv')
      setCsvText(file?.content || '')
    } catch { setCsvText('') }
  }, [useExample, refreshKey])
  useEffect(()=>{
    // Load calendar events with energyLevel, tags, workType, moodAfter from localStorage
    try {
      const raw = localStorage.getItem('calendar_events')
      if (!raw) { setCalendarEvents([]); return }
      const arr = JSON.parse(raw) as any[]
      const mapped = arr.map(ev=> ({ 
                          id: ev.id,
                          start: new Date(ev.start), 
                          end: ev.end ? new Date(ev.end) : undefined,
                          energyLevel: ev.energyLevel ?? ev.energy_level ?? undefined,
                          tags: ev.tags || [],
                          workType: ev.workType || undefined,
                          moodAfter: ev.moodAfter ?? undefined,
                          goalAchievement: ev.goalAchievement ?? undefined,
                          title: ev.title || undefined,
                          description: ev.description || undefined,
                          recurrence: ev.recurrence || undefined,
                        }))
                        .filter(e=> e.start instanceof Date && !isNaN(e.start.getTime()))
      setCalendarEvents(mapped)
    } catch { setCalendarEvents([]) }
  }, [])
  // Load subject confidence/importance averages + per-concept rows from Subject Setup (Supabase)
  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const uid = sess?.session?.user?.id
        if (!uid) { setSubjectAvgs([]); setSubjectVocabMap({}); setSelectedVocabSubject(''); return }
        const subs = await DatabaseService.getSubjects(uid)
        const results: { subject: string; avgConfidence: number; avgImportance: number }[] = []
        const map: Record<string, { concept: string; confidence: number | null; importance: number | null }[]> = {}
        const names: string[] = []
        for (const s of subs) {
          const name = s.name
          names.push(name)
          try {
            const slug = (s as any).slug || ''
            let vocab: any[] = []
            if (slug) {
              const rows = await DatabaseService.getSubjectVocab(uid, slug)
              vocab = Array.isArray(rows) ? rows : []
            }
            const confs = vocab.map((v:any)=> Number(v.confidence)).filter((n:any)=> Number.isFinite(n))
            const imps = vocab.map((v:any)=> Number(v.importance)).filter((n:any)=> Number.isFinite(n))
            const avgC = confs.length ? confs.reduce((a:number,b:number)=>a+b,0)/confs.length : 0
            const avgI = imps.length ? imps.reduce((a:number,b:number)=>a+b,0)/imps.length : 0
            results.push({ subject: name, avgConfidence: +avgC.toFixed(2), avgImportance: +avgI.toFixed(2) })
            map[name] = vocab.map((v:any, idx:number) => ({
              concept: String(v.concept ?? v.term ?? v.name ?? v.word ?? `item ${idx+1}`),
              confidence: Number.isFinite(Number(v.confidence)) ? Number(v.confidence) : null,
              importance: Number.isFinite(Number(v.importance)) ? Number(v.importance) : null,
            }))
          } catch {
            // ensure subject appears even if vocab fetch fails
            map[name] = map[name] || []
            results.push({ subject: name, avgConfidence: 0, avgImportance: 0 })
          }
        }
        setSubjectAvgs(results)
        setSubjectVocabMap(map)
        setSubjectNames(names.sort((a,b)=> a.localeCompare(b)))
        // Initialize selected subject: prefer persisted selection if available; else first subject
        if (!selectedVocabSubject || !(selectedVocabSubject in map)) {
          const first = (names.sort((a,b)=> a.localeCompare(b))[0]) || Object.keys(map)[0] || ''
          setSelectedVocabSubject(first)
        }
      } catch {
        setSubjectAvgs([])
        setSubjectVocabMap({})
        setSelectedVocabSubject('')
      }
    })()
  }, [])

  const studyRows = useMemo(()=> csvText ? parseStudyCSV(csvText) : [], [csvText])
  const allSubjects = useMemo(()=> {
    const set = new Set<string>()
    studyRows.forEach(r=>{ const s=(r.subject||'').trim(); if (s) set.add(s) })
    return Array.from(set).sort()
  }, [studyRows])
  // Subject stats: hours total and last-5-session difficulty (from study timer CSV)
  const subjectStats = useMemo(()=>{
    const bySubject: Record<string, { minutes: number, entries: { dt: number, hardness: number }[] }> = {}
    studyRows.forEach(r=>{
      const subj = (r.subject || '').trim(); if (!subj) return
      const dt = new Date(r.started_at || r.date || r.ended_at)
      const t = isNaN(dt.getTime()) ? 0 : dt.getTime()
      const mins = Number.isFinite(r.duration_minutes) ? Number(r.duration_minutes) : 0
      const hard = Number.isFinite(r.hardness) ? Number(r.hardness) : NaN
      const rec = bySubject[subj] || { minutes: 0, entries: [] }
      rec.minutes += mins
      if (Number.isFinite(hard)) rec.entries.push({ dt: t, hardness: hard })
      bySubject[subj] = rec
    })
    const out = Object.entries(bySubject).map(([subject, { minutes, entries }])=>{
      entries.sort((a,b)=> a.dt - b.dt)
      const last5 = entries.slice(-5).map(e=> e.hardness)
      const difficulty5 = last5.length ? +(mean(last5).toFixed(2)) : null
      const hours = +(minutes/60).toFixed(2)
      return { subject, hours, difficulty5 }
    })
    out.sort((a,b)=> a.subject.localeCompare(b.subject))
    return out
  }, [studyRows])
  const filteredRows = useMemo(()=>{
    if (selectedSubject === 'All') return studyRows
    return studyRows.filter(r=> (r.subject||'') === selectedSubject)
  }, [studyRows, selectedSubject])

  // Persist range preferences
  useEffect(()=>{
    try {
      localStorage.setItem('analytics_range_mode', rangeMode)
      localStorage.setItem('analytics_range_start', customStart)
      localStorage.setItem('analytics_range_end', customEnd)
    } catch {}
  }, [rangeMode, customStart, customEnd])
  useEffect(() => {
    try { localStorage.setItem('analytics_category_include_tags', JSON.stringify(includeTags)) } catch {}
  }, [includeTags])
  useEffect(() => {
    try { localStorage.setItem('analytics_selected_vocab_subject', selectedVocabSubject) } catch {}
  }, [selectedVocabSubject])
  useEffect(() => {
    try { localStorage.setItem('analytics_happiness_range', happinessRange) } catch {}
  }, [happinessRange])

  // Compute active date range
  const activeRange = useMemo(()=>{
    const now = new Date()
    let start: Date
    let end: Date = now
    const todayStart = new Date(now)
    todayStart.setHours(0,0,0,0)
    if (rangeMode === 'week') {
      start = new Date(todayStart)
      start.setDate(start.getDate() - 6)
    } else if (rangeMode === 'month') {
      start = new Date(todayStart)
      start.setDate(start.getDate() - 29)
    } else {
      // custom
      if (customStart) {
        start = new Date(`${customStart}T00:00:00`)
      } else {
        start = new Date(todayStart)
        start.setDate(start.getDate() - 6)
      }
      if (customEnd) {
        const e = new Date(`${customEnd}T23:59:59.999`)
        end = e > now ? now : e
      }
      // Ensure start <= end
      if (start > end) { const tmp = start; start = new Date(end); start.setHours(0,0,0,0) }
    }
    return { start, end }
  }, [rangeMode, customStart, customEnd])

  const rangeLabel = useMemo(()=>{
    if (rangeMode === 'week') return 'past 7 days'
    if (rangeMode === 'month') return 'past 30 days'
    if (customStart && customEnd) return `${customStart} to ${customEnd}`
    return 'custom range'
  }, [rangeMode, customStart, customEnd])

  // This week range (today and previous 6 days)
  const weekRange = useMemo(()=>{
    const end = new Date()
    const start = new Date(end)
    start.setHours(0,0,0,0)
    start.setDate(start.getDate() - 6)
    return { start, end }
  }, [])

  // Weekly study metrics from calendar events (tagged 'study', excluding 'school')
  const weeklyStudy = useMemo(()=>{
    const { start, end } = weekRange
    const isStudy = (tags?: string[]) => {
      const t = (tags||[]).map(x=> String(x).toLowerCase())
      return t.includes('study') && !t.includes('school')
    }
    const events = calendarEvents.filter(e=> e.start >= start && e.start <= end && isStudy(e.tags) && e.end instanceof Date && !isNaN(e.end.getTime()))
    const durations = events.map(e=> Math.max(0, (e.end!.getTime() - e.start.getTime())/60000))
    const totalMins = durations.reduce((a,b)=> a+b, 0)
    const avgLen = durations.length ? totalMins / durations.length : 0
    // Build per-day map for last 7 days
    const dayKeys: string[] = []
    const cur = new Date(start)
    while (cur <= end) { dayKeys.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1) }
    const perDay: Record<string, number> = {}; dayKeys.forEach(k=> perDay[k]=0)
    events.forEach(e=>{ const k=e.start.toISOString().slice(0,10); perDay[k] = (perDay[k]||0) + Math.max(0, (e.end!.getTime()-e.start.getTime())/60000) })
    const dailyMins = dayKeys.map(k=> perDay[k]||0)
    const burnout = dailyMins.some(m=> m > 300)
    // Procrastination: no studying for 2 days in a row (check last two full days before today)
    const yesterday = new Date(end); yesterday.setDate(yesterday.getDate()-1); const yKey = yesterday.toISOString().slice(0,10)
    const dayBefore = new Date(end); dayBefore.setDate(dayBefore.getDate()-2); const dbKey = dayBefore.toISOString().slice(0,10)
    const procrastination = ((perDay[yKey]||0) === 0) && ((perDay[dbKey]||0) === 0)
    // Streak: consecutive days up to today with >0 study
    let streak = 0
    const revKeys = dayKeys.slice().reverse()
    for (const k of revKeys) { if ((perDay[k]||0) > 0) streak++; else break }
    return { totalMins, avgLen, dailyMins, burnout, procrastination, streak }
  }, [calendarEvents, weekRange])

  // Goals achieved this week from CSV and calendar events
  const goalsAchievedThisWeek = useMemo(()=>{
    const { start, end } = weekRange
    let yes = 0
    // From CSV
    studyRows.forEach(r=>{ 
      const d=new Date(r.ended_at||r.date||r.started_at); 
      if(isNaN(d.getTime())|| d<start || d>end) return; 
      // Check goal_achievement field first
      if (r.goal_achievement === 0.5 || r.goal_achievement === '0.5' || r.goal_achievement === 1 || r.goal_achievement === '1') {
        yes++
      } else {
        // Fallback to old reached_goal field
        const ok=(r.reached_goal||'').toLowerCase().startsWith('y'); 
        if (ok) yes++
      }
    })
    // From calendar events
    calendarEvents.forEach(e=>{
      if (e.start >= start && e.start <= end && typeof e.goalAchievement === 'number' && e.goalAchievement >= 0.5) {
        yes++
      }
    })
    return yes
  }, [studyRows, calendarEvents, weekRange])

  // Today average energy (warn if <= 2)
  const todayEnergyAvg = useMemo(()=>{
    const now = new Date()
    const start = new Date(now); start.setHours(0,0,0,0)
    const end = new Date(now); end.setHours(23,59,59,999)
    const vals:number[] = []
    calendarEvents.forEach(e=>{ if (e.start>=start && e.start<=end && Number.isFinite(e.energyLevel as any)) vals.push(Number(e.energyLevel)) })
    return vals.length ? mean(vals) : NaN
  }, [calendarEvents])

  // Filter rows/events to active date range
  const rangeFilteredRows = useMemo(()=>{
    const { start, end } = activeRange
    return filteredRows.filter(r=>{
      const d = new Date(r.started_at || r.date || r.ended_at)
      return !isNaN(d.getTime()) && d >= start && d <= end
    })
  }, [filteredRows, activeRange])
  const rangeCalendarEvents = useMemo(()=>{
    const { start, end } = activeRange
    return calendarEvents.filter(e=> e.start >= start && e.start <= end)
  }, [calendarEvents, activeRange])

  const energyByHour = useMemo(()=>{
    const buckets = Array.from({length:24}, (_,h)=>({ hour: `${h}:00`, avgEnergy: 0, minutes: 0 }))
    const sums = Array(24).fill(0), counts = Array(24).fill(0)
    // CSV rows (active range)
    rangeFilteredRows.forEach(r=>{ const d=new Date(r.started_at||r.date); if(isNaN(d.getTime())) return; const h=d.getHours(); const val = r[energyMetric]; if(Number.isFinite(val)){sums[h]+=val; counts[h]++} buckets[h].minutes += Number.isFinite(r.duration_minutes)? r.duration_minutes: 0 })
    // Calendar events (active range)
    rangeCalendarEvents.forEach(e=>{ const h=e.start.getHours(); const val=e.energyLevel; if(Number.isFinite(val as any)){ sums[h]+= Number(val); counts[h]++ } })
    buckets.forEach((b,idx)=> b.avgEnergy = counts[idx]? sums[idx]/counts[idx]: 0)
    return buckets
  }, [rangeFilteredRows, energyMetric, rangeCalendarEvents])
  const energyByWeekday = useMemo(()=>{
    const sums = Array(7).fill(0), counts = Array(7).fill(0)
    rangeFilteredRows.forEach(r=>{ const d=new Date(r.started_at||r.date); if(isNaN(d.getTime())) return; const wd=d.getDay(); const val=r[energyMetric]; if(Number.isFinite(val)){sums[wd]+=val; counts[wd]++} })
    rangeCalendarEvents.forEach(e=>{ const wd=e.start.getDay(); const val=e.energyLevel; if(Number.isFinite(val as any)){ sums[wd]+= Number(val); counts[wd]++ } })
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name,idx)=>({ day:name, avgEnergy: counts[idx]? sums[idx]/counts[idx]: 0 }))
  }, [rangeFilteredRows, energyMetric, rangeCalendarEvents])
  const happinessByWeekday = useMemo(()=>{
    const sums = Array(7).fill(0), counts = Array(7).fill(0)
    rangeFilteredRows.forEach(r=>{ const d=new Date(r.ended_at||r.date); if(isNaN(d.getTime())) return; const wd=d.getDay(); if(Number.isFinite(r.happiness)){sums[wd]+=r.happiness; counts[wd]++} })
    rangeCalendarEvents.forEach(e=>{ const wd=e.start.getDay(); const val=e.moodAfter; if(Number.isFinite(val as any)){ sums[wd]+= Number(val); counts[wd]++ } })
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name,idx)=>({ day:name, happiness: counts[idx]? sums[idx]/counts[idx]: 0 }))
  }, [rangeFilteredRows, rangeCalendarEvents])
  const hoursByWeekday = useMemo(()=>{
    const mins = Array(7).fill(0)
    // CSV sessions (active range)
    rangeFilteredRows.forEach(r=>{ const d=new Date(r.started_at||r.date); if(isNaN(d.getTime())) return; const wd=d.getDay(); mins[wd]+= (Number.isFinite(r.duration_minutes)? r.duration_minutes:0) })
    // Calendar events tagged as "study" (active range)
    rangeCalendarEvents.forEach(e=>{
      const tagsLower = (e.tags || []).map(t => String(t).toLowerCase())
      if (!tagsLower.includes('study')) return
      const start = e.start
      const end = e.end
      if (!(start instanceof Date) || isNaN(start.getTime())) return
      if (!(end instanceof Date) || isNaN(end.getTime())) return
      const delta = (end.getTime() - start.getTime()) / 60000
      if (!Number.isFinite(delta) || delta <= 0) return
      const wd = start.getDay()
      mins[wd] += delta
    })
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name,idx)=>({ day:name, hours: +(mins[idx]/60).toFixed(2) }))
  }, [rangeFilteredRows, rangeCalendarEvents])
  const breaksByWeekday = useMemo(()=>{
    const counts = Array(7).fill(0)
    rangeFilteredRows.forEach(r=>{ const d=new Date(r.started_at||r.date); if(isNaN(d.getTime())) return; const wd=d.getDay(); const toks=(r.breaks||'').split(/;|,|\|/).map((s:string)=>s.trim()).filter(Boolean); counts[wd]+= toks.length })
    // Add calendar events tagged as break or workType break
    rangeCalendarEvents.forEach(e=>{ const wd=e.start.getDay(); const isBreak = (e.workType === 'break') || ((e.tags||[]).includes('break')); if (isBreak) counts[wd] += 1 })
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name,idx)=>({ day:name, breaks: counts[idx] }))
  }, [rangeFilteredRows, rangeCalendarEvents])
  // Standard categories that should always be available to filter
  const STANDARD_TAGS = useMemo(() => ['break','study','health','chores','important','social','school','else'], [])
  // Activity categories pie (time by tag/workType) within active range
  const categoryPie = useMemo(() => {
    const map: Record<string, number> = {}
    const includeSet = new Set(includeTags.map(t => String(t).toLowerCase()))
    rangeCalendarEvents.forEach(e => {
      const end = e.end instanceof Date ? e.end : null
      if (!end) return
      const mins = (end.getTime() - e.start.getTime()) / 60000
      if (!Number.isFinite(mins) || mins <= 0) return
      const tagsLower = (e.tags || []).map(t => String(t).toLowerCase().trim()).filter(Boolean)
      const tagSet = new Set<string>(tagsLower)
      // Map workType break into tags for filtering convenience
      if (e.workType === 'break') tagSet.add('break')
      // Determine if this event should be included based on selected tags
      if (includeSet.size > 0) {
        let included = false
        for (const t of includeSet) {
          if (t === 'else') {
            if (tagSet.size === 0) { included = true; break }
          } else if (tagSet.has(t)) { included = true; break }
        }
        if (!included) return
      }
      // Determine category label for this event
      let cat = 'else'
      if (tagSet.has('study')) cat = 'study'
      else if (tagSet.has('break')) cat = 'break'
      else {
        // Prefer any of the standard tags in order, then fall back to first tag
        const preferred = ['health','chores','important','social','school']
        const found = preferred.find(t => tagSet.has(t))
        if (found) cat = found
        else if (tagsLower.length > 0) cat = tagsLower[0]
      }
      map[cat] = (map[cat] || 0) + mins
    })
    const entries = Object.entries(map).map(([name, minutes]) => ({ name, value: +(minutes / 60).toFixed(2) }))
    entries.sort((a, b) => b.value - a.value)
    return entries
  }, [rangeCalendarEvents, includeTags])
  const availableTags = useMemo(() => {
    // Union of standard tags and all tags encountered in events within range
    const set = new Set<string>(STANDARD_TAGS)
    rangeCalendarEvents.forEach(e => {
      const tagsLower = (e.tags || []).map(t => String(t).toLowerCase().trim()).filter(Boolean)
      tagsLower.forEach(t => set.add(t))
      if (e.workType === 'break') set.add('break')
    })
    return Array.from(set).sort()
  }, [rangeCalendarEvents, STANDARD_TAGS])
  const energyDeltaByBreak = useMemo(()=>{
    const map = new Map<string, {sum:number, count:number}>()
    // From CSV: use after - before and group by each break token (active range)
    rangeFilteredRows.forEach(r=>{
      const eb = Number(r.energy_before)
      const ea = Number(r.energy_after)
      if (!Number.isFinite(eb) || !Number.isFinite(ea)) return
      const delta = ea - eb
      const toks = (r.breaks||'').toLowerCase().split(/;|,|\|/).map((s:string)=>s.trim()).filter(Boolean)
      const uniq: string[] = Array.from(new Set<string>(toks))
      uniq.forEach((t: string)=>{
        const cur = map.get(t) || {sum:0,count:0}
        cur.sum += delta
        cur.count += 1
        map.set(t, cur)
      })
    })
    // From calendar: events tagged as break (or workType break) (active range)
    rangeCalendarEvents.forEach(e=>{
      const isBreak = (e.workType === 'break') || ((e.tags||[]).includes('break'))
      if (!isBreak) return
      const name = (e.title || 'break').toLowerCase().trim() || 'break'
      const val = Number(e.energyLevel)
      if (!Number.isFinite(val)) return
      const cur = map.get(name) || {sum:0,count:0}
      // No before/after; per request, use the energy level value itself to contribute
      cur.sum += val
      cur.count += 1
      map.set(name, cur)
    })
    const arr = Array.from(map.entries()).map(([b,{sum,count}])=>({ break: b, delta: count? sum/count: 0, count }))
    // sort by delta descending
    arr.sort((a,b)=> b.delta - a.delta)
    return arr
  }, [rangeFilteredRows, rangeCalendarEvents])
  const goalRateOverTime = useMemo(()=>{
    const { start, end } = activeRange
    const byDate: Record<string,{less:number,exact:number,more:number}> = {}
    
    // From CSV data - use new goal_achievement field
    rangeFilteredRows.forEach(r=>{ 
      const d=new Date(r.ended_at||r.date); 
      if(isNaN(d.getTime())|| d<start || d>end) return; 
      const key=d.toISOString().slice(0,10); 
      if(!byDate[key]) byDate[key] = {less:0,exact:0,more:0}
      
      if (r.goal_achievement === 0 || r.goal_achievement === '0') byDate[key].less++
      else if (r.goal_achievement === 0.5 || r.goal_achievement === '0.5') byDate[key].exact++
      else if (r.goal_achievement === 1 || r.goal_achievement === '1') byDate[key].more++
      // Fallback to old reached_goal format if goal_achievement not available
      else if (r.reached_goal) {
        const ok = (r.reached_goal||'').toLowerCase().startsWith('y')
        if (ok) byDate[key].exact++
        else byDate[key].less++
      }
    })
    
    // From calendar events
    rangeCalendarEvents.forEach(e=>{
      const key = e.start.toISOString().slice(0,10)
      if(!byDate[key]) byDate[key] = {less:0,exact:0,more:0}
      
      if (typeof e.goalAchievement === 'number') {
        if (e.goalAchievement === 0) byDate[key].less++
        else if (e.goalAchievement === 0.5) byDate[key].exact++
        else if (e.goalAchievement === 1) byDate[key].more++
      }
    })
    
    return Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,val])=>({ 
      date, 
      less: val.less,
      exact: val.exact,
      more: val.more,
      total: val.less + val.exact + val.more,
      successRate: val.total > 0 ? (val.exact + val.more) / val.total : 0 // exact + more = success
    }))
  }, [rangeFilteredRows, rangeCalendarEvents, activeRange])

  // Study Session Duration Over Time (from calendar events tagged with 'study')
  const studySessionDurations = useMemo(() => {
    const { start, end } = activeRange
    const studySessions: { date: string; duration: number; title: string }[] = []
    
    rangeCalendarEvents.forEach(e => {
      const tagsLower = (e.tags || []).map(t => String(t).toLowerCase())
      if (!tagsLower.includes('study')) return
      
      const endTime = e.end instanceof Date ? e.end : null
      if (!endTime) return
      
      const durationMinutes = (endTime.getTime() - e.start.getTime()) / 60000
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return
      
      studySessions.push({
        date: e.start.toISOString().slice(0, 10),
        duration: Math.round(durationMinutes),
        title: e.title || 'Study Session'
      })
    })
    
    // Group by date and sum durations
    const byDate: Record<string, { totalMinutes: number; sessionCount: number; sessions: string[] }> = {}
    studySessions.forEach(session => {
      if (!byDate[session.date]) {
        byDate[session.date] = { totalMinutes: 0, sessionCount: 0, sessions: [] }
      }
      byDate[session.date].totalMinutes += session.duration
      byDate[session.date].sessionCount += 1
      byDate[session.date].sessions.push(session.title)
    })
    
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        totalHours: Number((data.totalMinutes / 60).toFixed(2)),
        totalMinutes: data.totalMinutes,
        sessionCount: data.sessionCount,
        averageSessionLength: Math.round(data.totalMinutes / data.sessionCount),
        sessions: data.sessions
      }))
  }, [rangeCalendarEvents, activeRange])

  // Goal Achievement Analytics: Track if goals are too big/good/small
  const goalAchievementStats = useMemo(() => {
    const { start, end } = activeRange
    let lessCount = 0, exactCount = 0, moreCount = 0
    
    // From study timer CSV data
    rangeFilteredRows.forEach(r => {
      const d = new Date(r.ended_at || r.date)
      if (isNaN(d.getTime()) || d < start || d > end) return
      
      if (r.goal_achievement === 0 || r.goal_achievement === '0') lessCount++
      else if (r.goal_achievement === 0.5 || r.goal_achievement === '0.5') exactCount++
      else if (r.goal_achievement === 1 || r.goal_achievement === '1') moreCount++
    })
    
    // From calendar events
    rangeCalendarEvents.forEach(e => {
      if (typeof e.goalAchievement === 'number') {
        if (e.goalAchievement === 0) lessCount++
        else if (e.goalAchievement === 0.5) exactCount++
        else if (e.goalAchievement === 1) moreCount++
      }
    })
    
    const total = lessCount + exactCount + moreCount
    if (total === 0) return null
    
    return {
      less: { count: lessCount, percentage: Math.round((lessCount / total) * 100) },
      exact: { count: exactCount, percentage: Math.round((exactCount / total) * 100) },
      more: { count: moreCount, percentage: Math.round((moreCount / total) * 100) },
      total,
      averageAchievement: Number(((lessCount * 0 + exactCount * 0.5 + moreCount * 1) / total).toFixed(2))
    }
  }, [rangeFilteredRows, rangeCalendarEvents, activeRange])

  // Happiness over time with configurable range
  const happinessOverTime = useMemo(()=>{
    const now = new Date()
    // Aggregate happiness per day from CSV and calendar
    const map: Record<string, number[]> = {}
    studyRows.forEach(r=>{
      const d = new Date(r.ended_at || r.date || r.started_at)
      if (isNaN(d.getTime()) || d > now) return
      if (Number.isFinite(r.happiness)) {
        const key = d.toISOString().slice(0,10)
        if (!map[key]) map[key] = []
        map[key].push(Number(r.happiness))
      }
    })
    calendarEvents.forEach(e=>{
      const d = e.start
      if (!(d instanceof Date) || isNaN(d.getTime()) || d > now) return
      if (Number.isFinite(e.moodAfter as any)) {
        const key = d.toISOString().slice(0,10)
        if (!map[key]) map[key] = []
        map[key].push(Number(e.moodAfter))
      }
    })
    
    // Determine start date based on happiness range selection
    const start = new Date(now)
    start.setHours(0,0,0,0)
    if (happinessRange === 'week') {
      start.setDate(start.getDate() - 6)
    } else if (happinessRange === 'month') {
      start.setDate(start.getDate() - 29)
    } else if (happinessRange === 'year') {
      start.setDate(start.getDate() - 364)
    }
    
    const days: {date:string, happiness:number|null}[] = []
    const cursor = new Date(start)
    while (cursor <= now) {
      const key = cursor.toISOString().slice(0,10)
      const vals = map[key] || []
      days.push({ date: key, happiness: vals.length ? mean(vals) : null })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [studyRows, calendarEvents, happinessRange])

  // Clearer correlations over active range: daily aggregates across Happiness, Breaks, Study time, Energy, Goal rate, Hardness
  const correlationMatrix = useMemo(()=>{
    const { start, end } = activeRange
    const dayKeys: string[] = []
    const cursor = new Date(start)
    while (cursor <= end) { dayKeys.push(cursor.toISOString().slice(0,10)); cursor.setDate(cursor.getDate()+1) }
    const agg: Record<string, {hVals:number[], bCount:number, tMins:number, eVals:number[], goalsY:number, goalsN:number, hardnessVals:number[]}> = {}
    dayKeys.forEach(k=> agg[k] = { hVals: [], bCount: 0, tMins: 0, eVals: [], goalsY: 0, goalsN: 0, hardnessVals: [] })
    // CSV
    rangeFilteredRows.forEach(r=>{
      const d = new Date(r.started_at || r.date || r.ended_at)
      if (isNaN(d.getTime())) return
      const key = d.toISOString().slice(0,10)
      if (!(key in agg)) return
      if (Number.isFinite(r.happiness)) agg[key].hVals.push(Number(r.happiness))
      const breaks = (r.breaks||'').split(/;|,|\|/).map((s:string)=>s.trim()).filter(Boolean)
      agg[key].bCount += breaks.length
      if (Number.isFinite(r.duration_minutes)) agg[key].tMins += Number(r.duration_minutes)
      if (Number.isFinite(r.energy_before)) agg[key].eVals.push(Number(r.energy_before))
      if (Number.isFinite(r.energy_after)) agg[key].eVals.push(Number(r.energy_after))
      if (typeof r.reached_goal === 'string') {
        const ok = (r.reached_goal || '').toLowerCase().startsWith('y')
        if (ok) agg[key].goalsY += 1; else agg[key].goalsN += 1
      }
      if (Number.isFinite(r.hardness)) agg[key].hardnessVals.push(Number(r.hardness))
    })
    // Calendar
    rangeCalendarEvents.forEach(e=>{
      const key = e.start.toISOString().slice(0,10)
      if (!(key in agg)) return
      const tagsLower = (e.tags || []).map(t => String(t).toLowerCase())
      if (Number.isFinite(e.moodAfter as any)) agg[key].hVals.push(Number(e.moodAfter))
      const isBreak = (e.workType === 'break') || tagsLower.includes('break')
      if (isBreak) agg[key].bCount += 1
      if (tagsLower.includes('study') && e.end instanceof Date && !isNaN(e.end.getTime())) {
        const mins = (e.end.getTime() - e.start.getTime())/60000
        if (Number.isFinite(mins) && mins > 0) agg[key].tMins += mins
      }
      if (Number.isFinite(e.energyLevel as any)) agg[key].eVals.push(Number(e.energyLevel))
      // No goal/hardness in calendar events
    })
    const H: number[] = []
    const B: number[] = []
    const T: number[] = []
    const E: number[] = []
    const G: number[] = [] // goal rate per day
    const R: number[] = [] // hardness average per day
    dayKeys.forEach(k=>{
      const a = agg[k] || { hVals: [], bCount: 0, tMins: 0, eVals: [], goalsY: 0, goalsN: 0, hardnessVals: [] }
      const h = a.hVals.length ? mean(a.hVals) : NaN
      const e = a.eVals.length ? mean(a.eVals) : NaN
      const gden = a.goalsY + a.goalsN
      const g = gden ? a.goalsY / gden : NaN
      const r = a.hardnessVals.length ? mean(a.hardnessVals) : NaN
      H.push(h)
      B.push(a.bCount)
      T.push(a.tMins)
      E.push(e)
      G.push(g)
      R.push(r)
    })
    const labels = ['Happiness','Breaks','Study time','Energy','Goal rate','Hardness']
    const series = [H,B,T,E,G,R]
    const n = labels.length
    const matrix:number[][] = Array.from({length:n},()=>Array(n).fill(1))
    for (let i=0;i<n;i++){
      for (let j=0;j<n;j++){
        matrix[i][j] = i===j ? 1 : pearson(series[i], series[j])
      }
    }
    return { labels, matrix }
  }, [rangeFilteredRows, rangeCalendarEvents, activeRange])

  // Build AI advice and prompt whenever inputs change
  useEffect(() => {
    const build = async () => {
      setLoading(true)
      try {
        const analytics: StudyData = {
          totalStudyTime: weeklyStudy.totalMins,
          averageSessionLength: weeklyStudy.avgLen,
          productivityTrend: (() => {
            // Approximate: compare average of last 3 vs previous 3 goal rates
            if (!goalRateOverTime.length) return 0.75
            const rates = goalRateOverTime.map(d => d.rate)
            const last3 = rates.slice(-3)
            const prev3 = rates.slice(-6, -3)
            const avgLast = last3.length ? mean(last3) : mean(rates)
            const avgPrev = prev3.length ? mean(prev3) : avgLast
            const trend = avgPrev === 0 ? avgLast : (avgLast / avgPrev)
            // Normalize to ~0..1 scale around 0.7-1.3
            const norm = Math.max(0, Math.min(1, 0.5 + (trend - 1) * 0.8))
            return norm
          })(),
          burnoutRisk: (() => {
            const over5h = weeklyStudy.dailyMins.some(m => m > 300)
            const riskFromMax = Math.min(1, Math.max(0, (Math.max(...weeklyStudy.dailyMins) - 240) / 180))
            return over5h ? Math.max(0.65, riskFromMax) : Math.max(0.25, riskFromMax)
          })(),
          subjectPerformance: (() => {
            const map: Record<string, number> = {}
            subjectStats.forEach(s => {
              const score = s.difficulty5 == null ? 0.7 : Math.max(0, Math.min(1, 1 - (s.difficulty5 / 5)))
              map[s.subject] = score
            })
            return map
          })(),
          studyStreak: weeklyStudy.streak,
          weeklyGoals: goalsAchievedThisWeek, // using achieved as proxy
          weeklyAchievements: goalsAchievedThisWeek,
          dailyStudyHours: weeklyStudy.dailyMins.map(m => +(m / 60).toFixed(2)),
          subjectBreakdown: (() => {
            const map: Record<string, number> = {}
            subjectStats.forEach(s => { map[s.subject] = s.hours })
            return map
          })(),
        }
        setStudyData(analytics)

        const generated = await generateAIAdviceFromAllTabs()
        setAiAdvice(generated)

        if (analytics.burnoutRisk > 0.6) {
          setBurnoutWarning('High burnout risk detected. Consider taking a break.')
          try { await notificationService.sendBurnoutWarning(analytics) } catch {}
        } else {
          setBurnoutWarning(null)
        }
      } catch (e) {
        console.error('Failed to build analytics/insights', e)
      } finally {
        setLoading(false)
      }
    }
    build()
  }, [weeklyStudy, goalsAchievedThisWeek, subjectStats, goalRateOverTime, energyByHour, energyByWeekday, happinessByWeekday, hoursByWeekday, breaksByWeekday, energyDeltaByBreak, correlationMatrix, todayEnergyAvg, rangeLabel])

  const generateAIAdviceFromAllTabs = async (): Promise<AIAdvice[]> => {
    const out: AIAdvice[] = []

    // Overview-based
    if (weeklyStudy.burnout) {
      out.push({
        type: 'warning',
        title: 'Risk for burnout this week',
        message: 'You studied over 5 hours on at least one day this week. Plan a lighter day and prioritize recovery.',
        actionItems: ['Insert a full rest block', 'Cap sessions at 60–90 minutes', 'Use recovery breaks (walk, stretch, snack)'],
        priority: 'high',
        estimatedImpact: 'Lower fatigue and sustain performance'
      })
    }
    if (weeklyStudy.procrastination) {
      out.push({
        type: 'suggestion',
        title: 'Restart momentum after two no-study days',
        message: 'Two consecutive zero-study days detected. A 10–20 minute starter session can rebuild momentum.',
        actionItems: ['Start with a 10-minute timer', 'Pick a bite-sized task', 'Reward completion with a small break'],
        priority: 'medium',
        estimatedImpact: 'Reboot momentum quickly'
      })
    }
    if (Number.isFinite(todayEnergyAvg) && todayEnergyAvg <= 2) {
      out.push({
        type: 'suggestion',
        title: 'Low energy today',
        message: `Average energy today is ${todayEnergyAvg.toFixed(1)}. Favor lighter tasks and recovery before deep work.`,
        actionItems: ['Eat something nutritious', 'Take a 20 min power nap', 'Go for a brisk walk'],
        priority: 'medium',
        estimatedImpact: 'Improve study quality for the rest of the day'
      })
    }
    if (weeklyStudy.streak >= 7) {
      out.push({
        type: 'celebration',
        title: 'Great consistency',
        message: `A ${weeklyStudy.streak}-day streak—nice work. Consider a small reward and keep sessions sustainable.`,
        actionItems: ['Schedule a treat', 'Plan a lighter day', 'Maintain your rhythm'],
        priority: 'low',
        estimatedImpact: 'Maintain motivation'
      })
    }

    // Subjects-based
    const hardSubjects = subjectStats.filter(s => (s.difficulty5 ?? 0) >= 3.5).map(s => s.subject)
    if (hardSubjects.length) {
      out.push({
        type: 'strategy',
        title: 'Tough subjects identified',
        message: `Recent difficulty is high in: ${hardSubjects.join(', ')}. Try different methods and schedule during high-energy hours.`,
        actionItems: ['Switch technique (active recall, teach-back, practice tests)', 'Study during your top energy hours', 'Add micro-quizzes'],
        priority: 'medium',
        estimatedImpact: 'Lower perceived difficulty and increase retention'
      })
    }

    // Energy patterns
    const bestHours = energyByHour
      .map((b, h) => ({ h, v: b.avgEnergy }))
      .filter(x => Number.isFinite(x.v))
      .sort((a,b)=> b.v - a.v)
      .slice(0,3)
      .map(x => `${x.h}:00`)
    if (bestHours.length) {
      out.push({
        type: 'suggestion',
        title: 'Schedule deep work at peak energy times',
        message: `Your top energy hours appear around: ${bestHours.join(', ')}. Place challenging tasks there.`,
        actionItems: ['Block calendar time', 'Silence notifications', 'Use 60–90 min focus blocks'],
        priority: 'medium',
        estimatedImpact: 'Higher quality deep work'
      })
    }

    // Break effectiveness
    const topBreaks = energyDeltaByBreak.slice(0,3).filter(b => b.delta > 0.3).map(b => b.break)
    if (topBreaks.length) {
      out.push({
        type: 'suggestion',
        title: 'Use breaks that refill energy',
        message: `These breaks correlate with higher energy: ${topBreaks.join(', ')}. Prefer them between blocks.`,
        actionItems: ['Schedule short movement/food breaks', 'Avoid phone-scroll breaks', 'Track how you feel after breaks'],
        priority: 'low',
        estimatedImpact: 'Better energy management across the day'
      })
    }

    // Correlations
    const labels = correlationMatrix.labels
    const vals: { i:number,j:number,v:number }[] = []
    correlationMatrix.matrix.forEach((row,i)=> row.forEach((v,j)=>{ if (i!==j && Number.isFinite(v)) vals.push({i,j,v}) }))
    vals.sort((a,b)=> b.v - a.v)
    const strongPos = vals.filter(x=> x.v>0.4).slice(0,3)
    const strongNeg = vals.filter(x=> x.v<-0.4).slice(0,3)
    if (strongPos.length) {
      out.push({
        type: 'strategy',
        title: 'What rises together',
        message: strongPos.map(x=> `${labels[x.i]} ↔ ${labels[x.j]} (${x.v.toFixed(2)})`).join('; '),
        actionItems: ['Lean into positive pairs: schedule to exploit them'],
        priority: 'low',
        estimatedImpact: 'Incremental gains by aligning habits'
      })
    }
    if (strongNeg.length) {
      out.push({
        type: 'strategy',
        title: 'Trade-offs to watch',
        message: strongNeg.map(x=> `${labels[x.i]} ↔ ${labels[x.j]} (${x.v.toFixed(2)})`).join('; '),
        actionItems: ['Avoid pairing competing factors', 'Adjust schedule or method accordingly'],
        priority: 'low',
        estimatedImpact: 'Reduce friction and wasted effort'
      })
    }

    return out
  }

  const getBurnoutColor = (risk: number) => {
    if (risk < 0.3) return 'text-green-600 bg-green-50'
    if (risk < 0.6) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getProductivityColor = (trend: number) => {
    if (trend > 0.8) return 'text-green-600'
    if (trend > 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Diary throwbacks: yesterday, last week, last month, last year
  const diaryThrowbacks = useMemo(() => {
    const now = new Date()
    const mk = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); d.setHours(0,0,0,0); return d }
    const targets = [
      { key: 'yesterday', label: 'Yesterday', date: mk(1) },
      { key: 'week', label: 'One week ago', date: mk(7) },
      { key: 'month', label: 'One month ago', date: mk(30) },
      { key: 'year', label: 'One year ago', date: mk(365) },
    ] as const

    const sameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()

    const diaryEvents = calendarEvents.filter(e => {
      const t = String(e.title||'').toLowerCase()
      const tagsLower = (e.tags||[]).map(x=>String(x).toLowerCase())
      return t === 'diary' || tagsLower.includes('diary')
    })

    const findFor = (target: Date): { when: string, text: string|null } => {
      // Prefer explicit instance on that day
      const instance = diaryEvents
        .filter(e => e.start && sameDay(e.start, target))
        .sort((a,b)=> (a.start.getTime() - b.start.getTime()))[0]
      if (instance) {
        const txt = (instance.description || '').trim() || null
        const when = instance.start.toLocaleString()
        return { when, text: txt }
      }
      // Fallback: see if there is a daily recurring diary covering that date
      for (const e of diaryEvents) {
        const rec = e.recurrence
        if (!rec || rec.type !== 'daily') continue
        const start0 = new Date(e.start)
        start0.setHours(0,0,0,0)
        const endDate = rec.endDate ? new Date(rec.endDate) : null
        if (target < start0) continue
        if (endDate && target > new Date(new Date(endDate).setHours(23,59,59,999))) continue
        // Optional skipDates support
        const skips: string[] = Array.isArray(rec.skipDates) ? rec.skipDates.map((s:any)=> new Date(s).toISOString().slice(0,10)) : []
        const key = target.toISOString().slice(0,10)
        if (skips.includes(key)) continue
        // Use the base description (prompt)
        const when = `${key} ${String(new Date(e.start).getHours()).padStart(2,'0')}:${String(new Date(e.start).getMinutes()).padStart(2,'0')}`
        const txt = (e.description || '').trim() || null
        return { when, text: txt }
      }
      return { when: target.toDateString(), text: null }
    }

    const map: Record<string, { label: string, when: string, text: string|null }> = {}
    targets.forEach(t => {
      const res = findFor(t.date)
      map[t.key] = { label: t.label, when: res.when, text: res.text }
    })
    return map
  }, [calendarEvents])


  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2 text-2xl font-bold text-green-800">
          <LeafIcon className="w-8 h-8" />
          Study Analytics
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!studyData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-gray-500">
          No study data available. Start studying to see your analytics!
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-2xl font-bold text-green-800">
          <LeafIcon className="w-8 h-8" />
          Study Analytics
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshCsvData} className="bg-blue-50 border-blue-200 text-blue-700">
            🔄 Refresh Data
          </Button>
          <Button variant={useExample ? 'default' : 'outline'} onClick={()=>setUseExample(v=>!v)} className="bg-green-50 border-green-200 text-green-700">
            {useExample ? 'Remove Example Data' : 'Use Example Data'}
          </Button>
        </div>
      </div>

      {/* Overview warnings removed per user request */}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-green-50">
          <TabsTrigger value="overview" className="data-[state=active]:bg-green-200">Overview</TabsTrigger>
          <TabsTrigger value="subjects" className="data-[state=active]:bg-green-200">Subjects</TabsTrigger>
          <TabsTrigger value="trends" className="data-[state=active]:bg-green-200">Trends</TabsTrigger>
          <TabsTrigger value="ai-insights" className="data-[state=active]:bg-green-200">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics (This Week) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700">Total Study Time (This Week)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-800">
                  {Math.floor(weeklyStudy.totalMins/60)}h {Math.round(weeklyStudy.totalMins%60)}m
                </div>
                <p className="text-xs text-green-600 mt-1">Based on calendar events tagged “study” (excluding “school”)</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-700">Study Streak</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-800">
                  {weeklyStudy.streak} days
                </div>
                <p className="text-xs text-blue-600 mt-1">Consecutive days with study</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-700">Goals Achieved (This Week)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-800">
                  {goalsAchievedThisWeek}
                </div>
                <p className="text-xs text-orange-600 mt-1">From study timer session responses</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-700">Average Session Length</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-800">
                  {Math.round(weeklyStudy.avgLen)} min
                </div>
                <p className="text-xs text-purple-600 mt-1">Across this week’s study events</p>
              </CardContent>
            </Card>
          </div>

          {/* Diary throwbacks */}
          <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-rose-700">Diary throwbacks</CardTitle>
              <CardDescription className="text-xs">What you wrote around these dates</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['yesterday','week','month','year'] as const).map(key => (
                <div key={key} className="p-3 rounded border bg-white/50">
                  <div className="text-xs font-medium text-rose-700">{diaryThrowbacks[key].label}</div>
                  <div className="text-[11px] text-muted-foreground">{diaryThrowbacks[key].when}</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap">
                    {diaryThrowbacks[key].text || <span className="text-muted-foreground">No diary entry found.</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={useExample ? 'default' : 'outline'} onClick={()=>setUseExample(v=>!v)}>
              {useExample ? 'Remove Example Data' : 'Use Example Data'}
            </Button>
            <div className="text-sm text-muted-foreground">Subjects: {allSubjects.length}</div>
          </div>
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800">Subjects overview (last 5 sessions difficulty, total hours)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {subjectStats.length === 0 ? (
                <div className="text-sm text-gray-500">No subject data yet. Add study sessions or enable example data.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subjectStats.map((s)=> (
                    <div key={s.subject} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800">{s.subject}</div>
                        <div className="text-xs text-gray-500">hours: <b>{s.hours}</b></div>
                      </div>
                      <div className="mt-2 text-sm">
                        Recent difficulty (last 5): {s.difficulty5 ?? '—'} / 5
                      </div>
                      <Progress className="h-2 mt-2" value={(s.difficulty5 ?? 0) * 20} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confidence & Importance per concept row (select subject) */}
          <Card>
            <CardHeader>
              <CardTitle>Confidence and Importance per concept</CardTitle>
              <CardDescription>Pick a subject. X-axis shows each concept row. Scale 1–5.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 pb-1">
                {subjectNames.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No subjects found. Create a subject first.</div>
                ) : (
                  <>
                    <label className="text-xs">Subject</label>
                    <select
                      className="border rounded px-3 py-2 text-sm w-64"
                      value={selectedVocabSubject}
                      onChange={(e)=> setSelectedVocabSubject(e.target.value)}
                    >
                      {subjectNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </>
                )}
              </div>
              <div className="h-72">
                <ResponsiveContainer>
                  <RLineChart data={(subjectVocabMap[selectedVocabSubject] || []).map((r)=> ({
                    concept: String(r.concept).slice(0,24) || '(blank)',
                    confidence: r.confidence,
                    importance: r.importance,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="concept" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis domain={[0,5]} />
                    <RTooltip/>
                    <Legend/>
                    <Line type="monotone" dataKey="confidence" stroke="#10b981" name="Confidence" connectNulls />
                    <Line type="monotone" dataKey="importance" stroke="#3b82f6" name="Importance" connectNulls />
                  </RLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Study CSV Trends</CardTitle>
              <CardDescription>Load your study_sessions.csv (auto from Bank ➜ Home). Toggle example data to preview.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant={useExample ? 'default' : 'outline'} onClick={()=>setUseExample(v=>!v)}>
                  {useExample ? 'Remove Example Data' : 'Use Example Data'}
                </Button>
                <div className="flex items-center gap-2">
                  <Label htmlFor="csvfile">Upload CSV</Label>
                  <Input id="csvfile" type="file" accept=".csv,text/csv" onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setCsvText(String(r.result||'')); r.readAsText(f) }} />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <select id="subject" className="border rounded px-2 py-1"
                          value={selectedSubject}
                          onChange={(e)=>setSelectedSubject(e.target.value)}>
                    <option value="All">All</option>
                    {allSubjects.map(s=> (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="metric">Energy metric</Label>
                  <select id="metric" className="border rounded px-2 py-1"
                          value={energyMetric}
                          onChange={(e)=> setEnergyMetric(e.target.value as 'energy_before'|'energy_after')}>
                    <option value="energy_before">energy_before</option>
                    <option value="energy_after">energy_after</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="range">Range</Label>
                  <select id="range" className="border rounded px-2 py-1" value={rangeMode} onChange={(e)=> setRangeMode(e.target.value as any)}>
                    <option value="week">Past week</option>
                    <option value="month">Past month</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {rangeMode === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="from">From</Label>
                    <Input id="from" type="date" value={customStart} onChange={(e)=> setCustomStart(e.target.value)} />
                    <Label htmlFor="to">To</Label>
                    <Input id="to" type="date" value={customEnd} onChange={(e)=> setCustomEnd(e.target.value)} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={()=>{
                    const text = csvText || ''
                    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'study_sessions.csv'
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}>Download latest master CSV</Button>
                </div>
                <div className="text-sm text-muted-foreground">Rows: {filteredRows.length} {selectedSubject!=='All' && `(filtered)`}</div>
              </div>
            </CardContent>
          </Card>

          {studyRows.length>0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Energy vs Time by Hour ({energyMetric === 'energy_before' ? 'before' : 'after'}, {rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RLineChart data={energyByHour}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour"/>
                      <YAxis domain={[0,5]} />
                      <RTooltip/>
                      <Legend/>
                      <Line type="monotone" dataKey="avgEnergy" stroke="#10b981" name="Avg Energy" />
                    </RLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Energy by Weekday ({energyMetric === 'energy_before' ? 'before' : 'after'}, {rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer>
                    <RBarChart data={energyByWeekday}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0,5]} />
                      <RTooltip/>
                      <Bar dataKey="avgEnergy" fill="#22c55e" name="Avg Energy" />
                    </RBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Happiness by Weekday ({rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer>
                    <RLineChart data={happinessByWeekday}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0,5]} />
                      <RTooltip/>
                      <Line type="monotone" dataKey="happiness" stroke="#3b82f6" />
                    </RLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hours studied per weekday ({rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer>
                    <RBarChart data={hoursByWeekday}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <RTooltip/>
                      <Bar dataKey="hours" fill="#16a34a" name="Hours" />
                    </RBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Breaks per weekday ({rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer>
                    <RBarChart data={breaksByWeekday}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <RTooltip/>
                      <Bar dataKey="breaks" fill="#f59e0b" name="Breaks" />
                    </RBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Goal Achievement over time ({rangeLabel})</CardTitle>
                  <CardDescription>Shows if goals were too hard (less), just right (exact), or too easy (more)</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer>
                    <RLineChart data={goalRateOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RTooltip/>
                      <Legend/>
                      <Line type="monotone" dataKey="less" stroke="#dc2626" name="Too Hard (Less)" />
                      <Line type="monotone" dataKey="exact" stroke="#16a34a" name="Just Right (Exact)" />
                      <Line type="monotone" dataKey="more" stroke="#2563eb" name="Too Easy (More)" />
                    </RLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Study Session Duration Over Time */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Study Session Duration Over Time ({rangeLabel})</CardTitle>
                  <CardDescription>Daily totals of study sessions tagged with "study" from calendar events</CardDescription>
                </CardHeader>
                <CardContent>
                  {studySessionDurations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No study sessions found in this time range.</div>
                  ) : (
                    <>
                      <div className="h-80 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <RBarChart data={studySessionDurations}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 12 }}
                              tickFormatter={(value) => {
                                const date = new Date(value)
                                return `${date.getMonth() + 1}/${date.getDate()}`
                              }}
                            />
                            <YAxis 
                              tick={{ fontSize: 12 }}
                              label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                            />
                            <RTooltip 
                              formatter={([value, name]) => {
                                if (name === 'totalHours') {
                                  return [`${value} hours`, 'Study Time']
                                }
                                return [value, name]
                              }}
                              labelFormatter={(value) => {
                                const date = new Date(value)
                                return date.toLocaleDateString()
                              }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload || !payload.length) return null
                                const data = payload[0].payload
                                return (
                                  <div className="bg-background p-3 border rounded-lg shadow-lg">
                                    <p className="font-medium">{new Date(label).toLocaleDateString()}</p>
                                    <p>Study Time: <span className="font-semibold text-primary">{data.totalHours} hours</span></p>
                                    <p>Sessions: <span className="font-semibold text-blue-600">{data.sessionCount}</span></p>
                                    <p>Avg Length: <span className="font-semibold text-orange-600">{data.averageSessionLength} min</span></p>
                                    {data.sessions && data.sessions.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-sm font-medium">Sessions:</p>
                                        {data.sessions.slice(0, 3).map((session, idx) => (
                                          <p key={idx} className="text-xs text-muted-foreground truncate">
                                            • {session}
                                          </p>
                                        ))}
                                        {data.sessions.length > 3 && (
                                          <p className="text-xs text-muted-foreground">+{data.sessions.length - 3} more</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              }}
                            />
                            <Bar 
                              dataKey="totalHours" 
                              fill="hsl(var(--primary))" 
                              radius={[4, 4, 0, 0]}
                              opacity={0.8}
                              name="Study Hours"
                            />
                          </RBarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            {studySessionDurations.reduce((acc, d) => acc + d.totalHours, 0).toFixed(1)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Hours</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {studySessionDurations.reduce((acc, d) => acc + d.sessionCount, 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Sessions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {studySessionDurations.length > 0 ? 
                              (studySessionDurations.reduce((acc, d) => acc + d.totalHours, 0) / studySessionDurations.length).toFixed(1) : '0.0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-orange-600">
                            {studySessionDurations.length > 0 ?
                              Math.round(studySessionDurations.reduce((acc, d) => acc + d.averageSessionLength, 0) / studySessionDurations.length) : 0}
                          </p>
                          <p className="text-sm text-muted-foreground">Avg Session (min)</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Goal Setting Analysis and Time by Activity Category side-by-side */}
              <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Goal Achievement Analysis */}
                {goalAchievementStats && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Goal Setting Analysis ({rangeLabel})</CardTitle>
                      <CardDescription>Shows if your goals are too easy (more), just right (exact), or too hard (less)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-red-600">Too Hard (Less than goal)</span>
                            <div className="text-right">
                              <div className="text-lg font-bold text-red-600">{goalAchievementStats.less.count}</div>
                              <div className="text-xs text-muted-foreground">{goalAchievementStats.less.percentage}%</div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-600">Just Right (Exact goal)</span>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">{goalAchievementStats.exact.count}</div>
                              <div className="text-xs text-muted-foreground">{goalAchievementStats.exact.percentage}%</div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-blue-600">Too Easy (More than goal)</span>
                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-600">{goalAchievementStats.more.count}</div>
                              <div className="text-xs text-muted-foreground">{goalAchievementStats.more.percentage}%</div>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Average Achievement</span>
                              <span className="text-lg font-bold">{goalAchievementStats.averageAchievement}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              0 = always less, 0.5 = perfect, 1 = always more
                            </div>
                          </div>
                        </div>
                        <div className="h-48">
                          <ResponsiveContainer>
                            <RPieChart>
                              <Pie 
                                data={[
                                  { name: 'Too Hard', value: goalAchievementStats.less.count, fill: '#dc2626' },
                                  { name: 'Just Right', value: goalAchievementStats.exact.count, fill: '#16a34a' },
                                  { name: 'Too Easy', value: goalAchievementStats.more.count, fill: '#2563eb' }
                                ]} 
                                dataKey="value" 
                                nameKey="name" 
                                innerRadius={35} 
                                outerRadius={60}
                              />
                              <RTooltip formatter={(v:any,n:any)=> [`${v} sessions`, n]} />
                              <Legend/>
                            </RPieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      {goalAchievementStats.averageAchievement < 0.4 && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                          <div className="text-sm font-medium text-red-800">⚠️ Goal Setting Tip</div>
                          <div className="text-sm text-red-700 mt-1">
                            Your goals might be too ambitious. Consider setting smaller, more achievable goals to build momentum.
                          </div>
                        </div>
                      )}
                      {goalAchievementStats.averageAchievement > 0.7 && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="text-sm font-medium text-blue-800">🎯 Goal Setting Tip</div>
                          <div className="text-sm text-blue-700 mt-1">
                            You're consistently exceeding your goals! Consider setting more challenging goals to maximize your growth.
                          </div>
                        </div>
                      )}
                      {goalAchievementStats.averageAchievement >= 0.4 && goalAchievementStats.averageAchievement <= 0.7 && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="text-sm font-medium text-green-800">✅ Goal Setting Tip</div>
                          <div className="text-sm text-green-700 mt-1">
                            Great balance! Your goals are challenging but achievable. Keep it up!
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Activity categories time pie */}
                <Card>
                <CardHeader>
                  <CardTitle>Time by activity category (tags) ({rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="w-full lg:w-80">
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Choose which tags/categories to include in this chart</div>
                        <div className="flex flex-wrap gap-6 items-start">
                          <div>
                            <div className="text-xs font-medium mb-1">Include tags</div>
                            <div className="max-h-64 overflow-auto border rounded p-2 min-w-[200px]">
                              {availableTags.length === 0 ? (
                                <div className="text-xs text-gray-500">No tags</div>
                              ) : (
                                availableTags.map(tag => (
                                  <label key={`inc-${tag}`} className="flex items-center gap-2 text-xs py-0.5">
                                    <input
                                      type="checkbox"
                                      className="accent-green-600"
                                      checked={includeTags.includes(tag)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setIncludeTags(prev => Array.from(new Set([...prev.filter(t => t !== tag), tag])))
                                        } else {
                                          setIncludeTags(prev => prev.filter(t => t !== tag))
                                        }
                                      }}
                                    />
                                    <span>{tag}</span>
                                  </label>
                                ))
                              )}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <Button size="sm" variant="outline" onClick={() => setIncludeTags(availableTags)}>All</Button>
                              <Button size="sm" variant="outline" onClick={() => setIncludeTags([])}>None</Button>
                              <Button size="sm" variant="outline" onClick={() => setIncludeTags([])}>Clear</Button>
                            </div>
                          </div>
                        </div>
                        {includeTags.length>0 && (
                          <div className="text-xs text-muted-foreground">
                            Active include: [{includeTags.join(', ')}]
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 h-80 w-full">
                      <ResponsiveContainer>
                        <RPieChart>
                          <Pie data={categoryPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                            {categoryPie.map((entry, index) => {
                              const name = (entry as any).name as string
                              const color = name === 'study' ? '#16a34a' : name === 'break' ? '#f59e0b' : ['#94a3b8','#60a5fa','#22d3ee','#a78bfa','#f472b6'][index % 5]
                              return <Cell key={`cat-${index}`} fill={color} />
                            })}
                          </Pie>
                          <RTooltip formatter={(v:any,n:any)=> [`${v} h`, n]} />
                          <Legend/>
                        </RPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Energy gain per break type (after - before, {rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer>
                    <RBarChart data={energyDeltaByBreak}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="break" />
                      <YAxis domain={[-5,5]} />
                      <RTooltip/>
                      <Bar dataKey="delta" fill="#06b6d4" name="Δ energy" />
                    </RBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Correlations ({rangeLabel}, daily aggregates)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground mb-3">Positive = green (variables rise together), Negative = red (one rises as the other falls). Values range from -1 to 1.</div>
                  <div className="overflow-auto">
                    <div className="min-w-[420px]">
                      <div className="grid" style={{ gridTemplateColumns: `120px repeat(${correlationMatrix.labels.length}, 1fr)` }}>
                        <div></div>
                        {correlationMatrix.labels.map((lab, idx) => (
                          <div key={idx} className="px-2 py-1 text-xs font-medium text-center border-b">{lab}</div>
                        ))}
                        {correlationMatrix.labels.map((rowLab, i) => (
                          <Fragment key={`rowfrag-${i}`}>
                            <div className="px-2 py-1 text-xs font-medium border-r">{rowLab}</div>
                            {correlationMatrix.matrix[i].map((val, j) => {
                              const v = Math.max(-1, Math.min(1, val))
                              const green = Math.round(((v + 1) / 2) * 200) + 30
                              const red = Math.round(((1 - v) / 2) * 200) + 30
                              const bg = `rgb(${red}, ${green}, 120)`
                              const fg = Math.abs(v) > 0.6 ? '#fff' : '#111'
                              return (
                                <div key={`cell-${i}-${j}`} className="px-2 py-2 text-xs text-center border" style={{ backgroundColor: bg, color: fg }}>
                                  {v.toFixed(2)}
                                </div>
                              )
                            })}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Happiness over time with range controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Happiness over time</span>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant={happinessRange === 'week' ? 'default' : 'outline'}
                    onClick={() => setHappinessRange('week')}
                  >
                    Week
                  </Button>
                  <Button 
                    size="sm" 
                    variant={happinessRange === 'month' ? 'default' : 'outline'}
                    onClick={() => setHappinessRange('month')}
                  >
                    Month
                  </Button>
                  <Button 
                    size="sm" 
                    variant={happinessRange === 'year' ? 'default' : 'outline'}
                    onClick={() => setHappinessRange('year')}
                  >
                    Year
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer>
                <RLineChart data={happinessOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=> (typeof d === 'string' && d.length>=10) ? d.slice(5) : d} tick={{ fontSize: 10 }} />
                  <YAxis domain={[0,5]} tick={{ fontSize: 10 }} />
                  <RTooltip/>
                  <Line type="monotone" dataKey="happiness" stroke="#8b5cf6" connectNulls={false} />
                </RLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Advice */}
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <LeafIcon className="w-5 h-5" />
                  AI Study Insights (built from all tabs)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiAdvice.length > 0 ? (
                  aiAdvice.map((advice, index) => (
                    <div key={index} className="p-4 rounded-lg border border-green-200 bg-green-50">
                      <div className="flex items-start gap-2 mb-2">
                        <Badge variant="outline" className={
                          advice.type === 'warning' ? 'border-red-300 text-red-700 bg-red-50' :
                          advice.type === 'suggestion' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                          advice.type === 'celebration' ? 'border-purple-300 text-purple-700 bg-purple-50' :
                          'border-green-300 text-green-700 bg-green-50'
                        }>
                          {advice.type}
                        </Badge>
                        <div className="flex-1">
                          <h4 className="font-medium text-green-800">{advice.title}</h4>
                          <p className="text-sm text-green-700 mt-1">{advice.message}</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        {advice.actionItems.map((action, idx) => (
                          <div key={idx} className="text-xs text-green-600 flex items-center gap-1">
                            <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                            {action}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs bg-green-100 border-green-300 text-green-700">
                          Impact: {advice.estimatedImpact}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <LeafIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No insights available yet. Keep studying to receive personalized advice!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* On-demand guidance buttons */}
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">Need help right now?</CardTitle>
                <CardDescription>Tap a button to get targeted advice based on your data and the study guide.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant={focusAid==='start'?'default':'outline'} onClick={()=> setFocusAid('start')}>Struggling to start</Button>
                  <Button variant={focusAid==='continue'?'default':'outline'} onClick={()=> setFocusAid('continue')}>Struggling to continue</Button>
                  <Button variant={focusAid==='end'?'default':'outline'} onClick={()=> setFocusAid('end')}>Struggling to end</Button>
                  <div className="grow" />
                  <Button variant={useExample ? 'default':'outline'} onClick={()=> setUseExample(v=>!v)}>{useExample ? 'Remove Example Data' : 'Use Example Data'}</Button>
                </div>
                <GuidanceList focusAid={focusAid} weeklyStudy={weeklyStudy} todayEnergyAvg={todayEnergyAvg} energyByHour={energyByHour} energyDeltaByBreak={energyDeltaByBreak} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Inline component to render targeted guidance based on the Swedish study guide and current analytics
function GuidanceList({ focusAid, weeklyStudy, todayEnergyAvg, energyByHour, energyDeltaByBreak }:{
  focusAid: 'start'|'continue'|'end'|null,
  weeklyStudy: { totalMins: number; avgLen: number; dailyMins: number[]; burnout: boolean; procrastination: boolean; streak: number },
  todayEnergyAvg: number,
  energyByHour: { hour: string; avgEnergy: number }[],
  energyDeltaByBreak: { break: string; delta: number; count: number }[],
}) {
  if (!focusAid) {
    return (
      <div className="text-sm text-muted-foreground">Choose one of the buttons above to get quick, tailored advice.</div>
    )
  }

  const bestHours = energyByHour
    .map((b) => ({ label: b.hour, v: b.avgEnergy }))
    .filter(x => Number.isFinite(x.v))
    .sort((a,b)=> b.v - a.v)
    .slice(0,2)
    .map(x => x.label)

  const strongBreaks = energyDeltaByBreak.filter(b => b.delta > 0.3).slice(0,3).map(b => b.break)

  type Tip = { cat: 'Physical'|'Intellectual'|'Emotional', text: string }
  const tips: Tip[] = []

  if (focusAid === 'start') {
    // 8. CONCENTRATION – START (English)
    // Physical
    if (Number.isFinite(todayEnergyAvg) && todayEnergyAvg <= 2) {
      tips.push({ cat: 'Physical', text: 'Low energy today: Eat something nutritious, take a 20‑minute power nap, or go for a short walk before starting.' })
    } else {
      tips.push({ cat: 'Physical', text: 'Check the basics: food, sleep, and movement. Top off before you begin.' })
    }
    tips.push({ cat: 'Physical', text: 'Coffee or tea helps, but plan sessions when you are naturally alert—avoid 8am right after a late night.' })
    tips.push({ cat: 'Physical', text: 'Wear slightly uncomfortable clothes to stay alert. Use app/site blockers.' })
    tips.push({ cat: 'Physical', text: 'Place matters: study at a café, library, or park to avoid home distractions. If energy is low, stay briefly after school before going home. Do not study in bed. Use morning/evening based on your peak energy.' })
    tips.push({ cat: 'Physical', text: 'Study with a buddy for shared accountability.' })
    if (bestHours.length) tips.push({ cat: 'Physical', text: `Schedule your start at your peak hours (${bestHours.join(', ')}).` })

    // Intellectual
    tips.push({ cat: 'Intellectual', text: 'Break work into small, clear, even fun tasks; if that fails, lower your expectations temporarily.' })
    tips.push({ cat: 'Intellectual', text: 'Use visual timers to see time pass. Set alarms 15 min before, at start, and 15 min after to verify you actually did the task. Time yourself to learn real durations.' })
    tips.push({ cat: 'Intellectual', text: 'Attach new habits to existing ones (habit stacking).' })

    // Emotional
    tips.push({ cat: 'Emotional', text: 'If a task seems boring, give yourself the choice to do it—or something even more boring (e.g., doing the dishes). Boredom triggers creativity.' })
    tips.push({ cat: 'Emotional', text: 'Create a reusable template of what works for you.' })
    tips.push({ cat: 'Emotional', text: 'Reward yourself after studying.' })
    tips.push({ cat: 'Emotional', text: 'Set personal short‑ and long‑term goals and place them where you see them (e.g., phone background).' })
    if (weeklyStudy.procrastination) tips.push({ cat: 'Emotional', text: 'Two zero‑study days detected: start with a 10‑minute timer or even the 2‑minute rule to reboot momentum.' })
  }

  if (focusAid === 'continue') {
    // 9. CONCENTRATION – CONTINUE (English)
    // Physical
    tips.push({ cat: 'Physical', text: 'Sit alone and again use blocking tools to reduce distractions.' })
    tips.push({ cat: 'Physical', text: 'Take regular Pomodoro breaks—consider social, mental, emotional, physical, and even spiritual resets. Change environment and move your body.' })
    tips.push({ cat: 'Physical', text: 'Train focus longer over time with Pomodoro (e.g., align with playlists, apps). Increase focus intervals gradually.' })

    // Intellectual
    tips.push({ cat: 'Intellectual', text: 'Single‑task. Do only one thing at a time to protect focus.' })
    tips.push({ cat: 'Intellectual', text: 'Write down off‑topic thoughts to handle later.' })

    // Emotional
    tips.push({ cat: 'Emotional', text: 'Study buddy IRL/online: agree how to interrupt each other, support fun breaks and momentum.' })
    tips.push({ cat: 'Emotional', text: 'Revisit your why: short‑ and long‑term goals. Color your calendar green/red for activities that give/take energy.' })
    tips.push({ cat: 'Emotional', text: 'Use music without lyrics that makes you feel energetic and confident.' })
    tips.push({ cat: 'Emotional', text: 'Celebrate small wins during the session, not just at the end.' })

    if (weeklyStudy.burnout) tips.push({ cat: 'Physical', text: 'Keep focus blocks within ~60–90 minutes and add recovery breaks to avoid burnout.' })
    if (strongBreaks.length) tips.push({ cat: 'Physical', text: `Prefer breaks that refill energy: ${strongBreaks.join(', ')}. Avoid doom‑scroll breaks.` })
  }

  if (focusAid === 'end') {
    // 10. CONCENTRATION – END (English)
    // Physical
    tips.push({ cat: 'Physical', text: 'Use a timer and commit to a hard stop. Allow up to a 15‑minute wrap‑up. You can stop by time or by a small task quota. Create an ending routine.' })
    tips.push({ cat: 'Physical', text: 'Study at a place that closes (e.g., café) to force a stop.' })

    // Intellectual
    tips.push({ cat: 'Intellectual', text: 'Prepare the next session based on what remains. Log whether today’s goals were realistic. Capture exactly where you left off to avoid knowledge gaps.' })
    tips.push({ cat: 'Intellectual', text: 'Keep a mood/energy journal to detect whether you perform better in the morning or evening. Allow real rest when your body needs it; study when you’re effective.' })

    // Emotional
    tips.push({ cat: 'Emotional', text: 'Use a study buddy to ensure you take breaks and stop on time.' })
    tips.push({ cat: 'Emotional', text: 'Set a short timer to check in with your body before stopping—practice honoring your needs.' })
    tips.push({ cat: 'Emotional', text: 'Treat yourself like a beloved pet—care for yourself and sometimes be firm even when the task is fun.' })
    tips.push({ cat: 'Emotional', text: 'Plan something enjoyable after studying so you actually stop.' })
  }

  // Render grouped with color coding: Physical (blue), Intellectual (green), Emotional (orange)
  const colorFor = (cat: Tip['cat']) => cat === 'Physical' ? 'bg-blue-400' : cat === 'Intellectual' ? 'bg-green-500' : 'bg-orange-400'

  return (
    <div className="space-y-2">
      {tips.map((t, i) => (
        <div key={i} className="text-sm flex items-start gap-2">
          <span className={`mt-[6px] w-1.5 h-1.5 rounded-full ${colorFor(t.cat)}`} />
          <span>
            <span className={
              t.cat === 'Physical' ? 'text-blue-700' : t.cat === 'Intellectual' ? 'text-green-700' : 'text-orange-700'
            }>{t.cat}:</span> {t.text}
          </span>
        </div>
      ))}
    </div>
  )
}
