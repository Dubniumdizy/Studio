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
  const header = 'date,started_at,ended_at,user_id,subject,subject_id,duration_minutes,duration_seconds,energy_before,goal,exam_soon,reached_goal,happiness,energy_after,breaks,hardness,next_plan,forest_trees' + '\r\n'
  const rows = [
    // Week 1
    ['2025-09-15','2025-09-15T07:30:00Z','2025-09-15T08:30:00Z','u1','math','s1',60,3600,3,'review LA','no','yes',4,4,'drink/eat; stretch',2,'chapter 5 ex',3],
    ['2025-09-15','2025-09-15T16:00:00Z','2025-09-15T17:15:00Z','u1','physics','s2',75,4500,2,'hw set','no','no',3,3,'phone; social',4,'lab prep',2],
    ['2025-09-16','2025-09-16T13:00:00Z','2025-09-16T14:00:00Z','u1','chemistry','s3',60,3600,2,'notes','no','yes',4,4,'drink/eat',2,'read notes',4],
    ['2025-09-17','2025-09-17T20:00:00Z','2025-09-17T21:30:00Z','u1','math','s1',90,5400,3,'old exam','yes','yes',5,5,'study together',3,'next exam',5],
    ['2025-09-18','2025-09-18T09:00:00Z','2025-09-18T09:45:00Z','u1','physics','s2',45,2700,4,'repetition','no','no',2,3,'phone; hobby',4,'focus again',2],
    ['2025-09-19','2025-09-19T15:00:00Z','2025-09-19T16:30:00Z','u1','english','s4',90,5400,3,'essay','no','yes',4,4,'social',3,'revise draft',4],
    ['2025-09-20','2025-09-20T10:30:00Z','2025-09-20T12:00:00Z','u1','biology','s5',90,5400,4,'lab prep','no','yes',4,5,'power nap; drink/eat',3,'microscope review',5],
    // Week 2
    ['2025-09-22','2025-09-22T06:45:00Z','2025-09-22T07:30:00Z','u1','math','s1',45,2700,2,'morning warm-up','no','yes',3,4,'drink/eat',2,'quick recap',3],
    ['2025-09-23','2025-09-23T18:00:00Z','2025-09-23T19:30:00Z','u1','physics','s2',90,5400,2,'problem set','no','no',2,3,'phone; power nap',4,'retry problems',2],
    ['2025-09-24','2025-09-24T12:15:00Z','2025-09-24T13:15:00Z','u1','chemistry','s3',60,3600,3,'notes','no','yes',4,4,'study together',3,'summarize chapter',4],
    ['2025-09-25','2025-09-25T20:30:00Z','2025-09-25T22:00:00Z','u1','math','s1',90,5400,3,'old exam','yes','yes',5,5,'drink/eat; social',3,'mock exam',6],
    ['2025-09-26','2025-09-26T09:30:00Z','2025-09-26T10:15:00Z','u1','physics','s2',45,2700,4,'repetition','no','yes',3,4,'hobby',3,'lab notes',3],
    ['2025-09-27','2025-09-27T14:00:00Z','2025-09-27T15:30:00Z','u1','english','s4',90,5400,2,'reading','no','yes',4,3,'artistic; social',2,'write review',3],
    ['2025-09-28','2025-09-28T11:00:00Z','2025-09-28T12:30:00Z','u1','biology','s5',90,5400,3,'flashcards','no','yes',4,4,'drink/eat; study together',3,'next deck',4],
  ]
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
  const [calendarEvents, setCalendarEvents] = useState<{ start: Date; end?: Date; energyLevel?: number; tags?: string[]; workType?: string; moodAfter?: number; title?: string }[]>([])
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

  useEffect(()=>{
    if (useExample) { setCsvText(buildExampleCsv()); return }
    try {
      const raw = localStorage.getItem('bankData')
      if (!raw) { setCsvText(''); return }
      const bank = JSON.parse(raw)
      const home = bank.find((i:any)=>i.id==='home' && i.type==='folder')
      const file = home?.items?.find((it:any)=>it.type==='file' && it.name==='study_sessions.csv')
      setCsvText(file?.content || '')
    } catch { setCsvText('') }
  }, [useExample])
  useEffect(()=>{
    // Load calendar events with energyLevel, tags, workType, moodAfter from localStorage
    try {
      const raw = localStorage.getItem('calendar_events')
      if (!raw) { setCalendarEvents([]); return }
      const arr = JSON.parse(raw) as any[]
      const mapped = arr.map(ev=> ({ 
                          start: new Date(ev.start), 
                          end: ev.end ? new Date(ev.end) : undefined,
                          energyLevel: ev.energyLevel ?? ev.energy_level ?? undefined,
                          tags: ev.tags || [],
                          workType: ev.workType || undefined,
                          moodAfter: ev.moodAfter ?? undefined,
                          title: ev.title || undefined,
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

  // Goals achieved this week from CSV (reached_goal yes)
  const goalsAchievedThisWeek = useMemo(()=>{
    const { start, end } = weekRange
    let yes = 0
    studyRows.forEach(r=>{ const d=new Date(r.ended_at||r.date||r.started_at); if(isNaN(d.getTime())|| d<start || d>end) return; const ok=(r.reached_goal||'').toLowerCase().startsWith('y'); if (ok) yes++ })
    return yes
  }, [studyRows, weekRange])

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
    const byDate: Record<string,{yes:number,no:number}> = {}
    rangeFilteredRows.forEach(r=>{ const d=new Date(r.ended_at||r.date); if(isNaN(d.getTime())|| d<start || d>end) return; const key=d.toISOString().slice(0,10); const ok=(r.reached_goal||'').toLowerCase().startsWith('y'); byDate[key]=byDate[key]||{yes:0,no:0}; byDate[key][ok?'yes':'no']++ })
    return Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,val])=>({ date, rate: val.yes/(val.yes+val.no||1) }))
  }, [rangeFilteredRows, activeRange])

  // Long-term happiness over time (from earliest data to today, excluding future)
  const happinessOverTime = useMemo(()=>{
    const now = new Date()
    // Aggregate happiness per day from CSV and calendar
    const map: Record<string, number[]> = {}
    let minDate: Date | null = null
    studyRows.forEach(r=>{
      const d = new Date(r.ended_at || r.date || r.started_at)
      if (isNaN(d.getTime()) || d > now) return
      if (Number.isFinite(r.happiness)) {
        const key = d.toISOString().slice(0,10)
        if (!map[key]) map[key] = []
        map[key].push(Number(r.happiness))
      }
      if (!isNaN(d.getTime())) {
        if (!minDate || d < minDate) minDate = d
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
      if (!minDate || d < minDate) minDate = d
    })
    if (!minDate) return [] as {date:string, happiness:number|null}[]
    const start = new Date(minDate)
    start.setHours(0,0,0,0)
    const days: {date:string, happiness:number|null}[] = []
    const cursor = new Date(start)
    while (cursor <= now) {
      const key = cursor.toISOString().slice(0,10)
      const vals = map[key] || []
      days.push({ date: key, happiness: vals.length ? mean(vals) : null })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [studyRows, calendarEvents])

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
                  <CardTitle>Reached goal (rate) over time ({rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer>
                    <RLineChart data={goalRateOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0,1]} />
                      <RTooltip/>
                      <Line type="monotone" dataKey="rate" stroke="#10b981" />
                    </RLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Activity categories time pie */}
              <Card className="lg:col-span-2">
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
                          <Pie data={categoryPie} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110}>
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

          {/* Long-term happiness over time */}
          <Card>
            <CardHeader>
              <CardTitle>Happiness over time (from first record to today)</CardTitle>
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
