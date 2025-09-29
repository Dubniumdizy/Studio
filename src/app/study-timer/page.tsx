"use client";

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Play, Pause } from 'lucide-react'
import { TimerCircle } from '@/components/study-timer/timer-circle'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { LeafIcon } from '@/components/icons/leaf-icon'
import { studyAdvisor } from '@/ai/flows/study-advisor'
import { notificationService } from '@/lib/notifications'
import { useAuth } from '@/hooks/use-auth'
import { fetchSubjectsWithGoals } from '@/lib/supabase-goals'
import { supabase } from '@/lib/supabaseClient'
import { downloadCSV } from '@/lib/export'
import { useRouter } from 'next/navigation'
import { FocusInline } from '@/components/focus/FocusInline'
import { Forest } from '@/components/study-timer/Forest'
import { mockBankData, updateBankData, addFileToRoot, type FileOrFolder } from '@/lib/bank-data'

interface LocalStudySession {
  id: string
  subject: string
  duration: number
  energyLevel: number
  notes: string
  timestamp: Date
  productivity: number
}

type SubjectOption = { id: string; name: string; examDate?: string }

type PostSessionSurvey = {
  reachedGoal: boolean
  happiness: 1|2|3|4|5
  energyAfter: 1|2|3|4|5
  breaks: string[]
  hardness: 1|2|3|4|5
  nextPlan?: string
}

export default function StudyTimerPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState<number>(25) // 0 - 300
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [customSubject, setCustomSubject] = useState<string>('')
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [energyLevel, setEnergyLevel] = useState(4)
  // Removed notes per request
  const [sessionGoal, setSessionGoal] = useState('')
  const [examSoon, setExamSoon] = useState<boolean | null>(null)
  const [sessionHistory, setSessionHistory] = useState<LocalStudySession[]>([])
  const [showBreak, setShowBreak] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<string>('')
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [showSurvey, setShowSurvey] = useState(false)
  const [survey, setSurvey] = useState<PostSessionSurvey>({
    reachedGoal: false,
    happiness: 3,
    energyAfter: 3,
    breaks: [],
    hardness: 3,
    nextPlan: ''
  })
  const [savedBreaks, setSavedBreaks] = useState<string[]>([])
  const [currentSessionBreaks, setCurrentSessionBreaks] = useState<string[]>([])

  // Background media (YouTube or GIF)
  // Background disabled per request
  // (no YouTube/image background during sessions)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // WebAudio bell
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ringTimerRef = useRef<any>(null)
  // Removed AI advice per request
  const [blowForest, setBlowForest] = useState(false)

  // compute timeLeft when duration changes
  useEffect(() => {
    setTimeLeft(Math.max(0, Math.min(300, durationMinutes)) * 60)
  }, [durationMinutes])

  const energyLevels = [
    { value: 1, label: 'Very Low', color: 'text-red-600', bg: 'bg-red-50' },
    { value: 2, label: 'Low', color: 'text-orange-600', bg: 'bg-orange-50' },
    { value: 3, label: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { value: 4, label: 'Good', color: 'text-green-600', bg: 'bg-green-50' },
    { value: 5, label: 'Excellent', color: 'text-blue-600', bg: 'bg-blue-50' }
  ]

  useEffect(() => {
    // Load session history and saved breaks from localStorage
    const savedHistory = localStorage.getItem('studySessionHistory')
    if (savedHistory) {
      try {
        const raw = JSON.parse(savedHistory)
        const parsed = Array.isArray(raw)
          ? raw.map((s: any) => ({
              ...s,
              // revive timestamp from string to Date
              timestamp: s.timestamp ? new Date(s.timestamp) : new Date(),
            }))
          : []
        setSessionHistory(parsed)
      } catch {
        // fallback: clear corrupt data
        setSessionHistory([])
      }
    }
    const savedBreaksStr = localStorage.getItem('studyBreaks')
    if (savedBreaksStr) setSavedBreaks(JSON.parse(savedBreaksStr))

    // Initialize audio
    try {
      audioRef.current = new Audio('/sounds/bell.mp3')
      audioRef.current.loop = true
      audioRef.current.volume = 1.0
    } catch {}
    // Lazily initialize WebAudio context (must be resumed by user gesture)
    try { audioCtxRef.current = new (window as any).AudioContext() } catch {}

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Fetch subjects from Supabase
  useEffect(() => {
    async function load() {
      if (!user?.id) return
      try {
        const rows = await fetchSubjectsWithGoals(user.id)
        const opts = rows.map(r => ({ id: r.id, name: r.name, examDate: r.examDate }))
        setSubjects(opts)
      } catch (e) {
        console.error('Failed to load subjects', e)
      }
    }
    load()
  }, [user?.id])

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSessionComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, timeLeft])

  const handleSessionComplete = async () => {
    setIsRunning(false)
    setShowBreak(true)
    setShowSurvey(true)
    
    // Play notification sound (soft bell, loop until acknowledged)
    // Start ringing bell repeatedly until acknowledged
    await startRinging()

    // Send notification (non-blocking, ignore errors)
    try { await notificationService.sendTimerComplete() } catch { /* ignore */ }

    // Background video disabled; no-op


    // Save session (local + Supabase)
    const subjectName = selectedSubjectId ? subjects.find(s => s.id === selectedSubjectId)?.name : (customSubject || 'General')
    if (sessionStartTime && subjectName) {
      const session: LocalStudySession = {
        id: Date.now().toString(),
        subject: subjectName,
        duration: Math.max(0, durationMinutes * 60 - (timeLeft)),
        energyLevel,
        notes: '',
        timestamp: sessionStartTime,
        productivity: calculateProductivity(),
      }
      const updatedHistory = [session, ...sessionHistory]
      setSessionHistory(updatedHistory)
      localStorage.setItem('studySessionHistory', JSON.stringify(updatedHistory))

      // Persist to Supabase if logged in
      if (user?.id) {
        try {
          const endedAtISO = new Date().toISOString()
          await supabase.from('study_sessions').insert({
            user_id: user.id,
            subject_id: selectedSubjectId || null,
            subject_name: subjectName,
            goal_text: sessionGoal || null,
            duration_minutes: Math.round(session.duration / 60),
            energy_before: energyLevel,
            notes: null,
            started_at: sessionStartTime.toISOString(),
            ended_at: endedAtISO
          })
          // Also log as a completed calendar activity
          const calEvent = {
            id: `done-session-${Date.now()}`,
            user_id: user.id,
            title: `Study: ${subjectName} (done)`,
            description: sessionGoal ? `Goal: ${sessionGoal}` : null,
            start: sessionStartTime.toISOString(),
            end: endedAtISO,
            all_day: false,
            tags: ['study','done']
          }
          void supabase.from('calendar_events').upsert(calEvent)
          // Update local cache so it appears immediately in Calendar
          try {
            const cached = localStorage.getItem('calendar_events')
            const arr = cached ? JSON.parse(cached) : []
            arr.push({ id: calEvent.id, title: calEvent.title, description: calEvent.description || undefined, start: new Date(calEvent.start), end: new Date(calEvent.end), allDay: false, tags: calEvent.tags })
            localStorage.setItem('calendar_events', JSON.stringify(arr))
          } catch {}
        } catch (e) {
          console.error('Failed to persist session', e)
        }
      }

      // Also export a CSV row so you have a "sheet" copy locally and upload to Bank storage if available
      try {
        const now = new Date()
        const filename = `study_session_${now.toISOString().slice(0,10)}.csv`
        const headers = ['timestamp_start','timestamp_end','user_id','subject_id','subject_name','goal','duration_minutes','energy_before','notes','productivity']
        const row = [
          sessionStartTime?.toISOString() || '',
          new Date().toISOString(),
          user?.id || '',
          selectedSubjectId || '',
          subjectName,
          sessionGoal || '',
          Math.round((Math.max(0, durationMinutes * 60 - (timeLeft))) / 60),
          energyLevel,
          '',
          Math.round(calculateProductivity()*100)
        ] as (string|number)[]

        // local download
        downloadCSV(headers, [row], filename)

        // upload to Supabase Storage (bucket: bank)
        try {
          const csvLine = (vals: any[]) => vals.map(v => {
            const s = String(v ?? '')
            return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
          }).join(',')
          const csv = headers.join(',') + '\n' + csvLine(row) + '\n'
          const blob = new Blob([csv], { type: 'text/csv' })
          const safeSubject = (subjectName || 'General').replace(/[^a-z0-9-_]+/gi, '_')
          const path = `study_sessions/${safeSubject}/${filename}`
          await supabase.storage.from('bank').upload(path, blob, { upsert: true, contentType: 'text/csv' })
        } catch (e) {
          console.warn('Upload to Bank storage failed (bucket bank might be missing):', e)
        }
      } catch (e) {
        console.error('CSV export failed', e)
      }
    }
  }

  const calculateProductivity = (): number => {
    // Productivity based solely on energy level (notes removed)
    const baseProductivity = energyLevel / 5
    return Math.min(1, baseProductivity)
  }

  // AI advice removed

  const startSession = () => {
    const subjectChosen = selectedSubjectId || customSubject.trim()
    if (!subjectChosen) {
      alert('Please choose or enter a subject first!')
      return
    }
    if (durationMinutes < 0 || durationMinutes > 300) {
      alert('Please choose a duration between 0 and 300 minutes (5 hours).')
      return
    }

    // Reset per-session forest score to 0 at start
    try { if (typeof window !== 'undefined') localStorage.setItem('forest_score','0') } catch {}

    setIsRunning(true)
    setSessionStartTime(new Date())
    setShowBreak(false)
    setAiAdvice('')
    setCurrentSessionBreaks([])
  }

  const pauseSession = () => {
    setIsRunning(false)
  }

  const resetSession = async () => {
    // If stopping while running, trigger blow-away before reset
    if (isRunning) {
      setBlowForest(true)
      // Reset forest score on early stop
      try { if (typeof window !== 'undefined') localStorage.setItem('forest_score','0') } catch {}
      await new Promise((r) => setTimeout(r, 1300))
      setBlowForest(false)
    }
    setIsRunning(false)
    setTimeLeft(Math.max(0, Math.min(300, durationMinutes)) * 60)
    setAiAdvice('')
    setShowBreak(false)
    setSessionStartTime(null)
    setShowSurvey(false)
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const stopRinging = () => {
    if (ringTimerRef.current) {
      clearInterval(ringTimerRef.current)
      ringTimerRef.current = null
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); audioRef.current.currentTime = 0 } catch {}
    }
  }

  const ringBellOnce = () => {
    // Prefer WebAudio to bypass autoplay constraints once user has interacted
    const ctx = audioCtxRef.current
    if (ctx) {
      const now = ctx.currentTime
      const g = ctx.createGain()
      // Even louder overall gain
      g.gain.setValueAtTime(0.002, now)
      g.gain.linearRampToValueAtTime(1.4, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.002, now + 1.5)
      g.connect(ctx.destination)

      const o1 = ctx.createOscillator()
      o1.type = 'sine'
      o1.frequency.setValueAtTime(880, now)
      o1.connect(g)
      o1.start(now)
      o1.stop(now + 1.2)

      const o2 = ctx.createOscillator()
      o2.type = 'triangle'
      o2.frequency.setValueAtTime(660, now)
      o2.connect(g)
      o2.start(now)
      o2.stop(now + 0.9)
    } else if (audioRef.current) {
      try { audioRef.current.play() } catch {}
    }
  }

  const startRinging = async () => {
    try { await audioCtxRef.current?.resume() } catch {}
    ringBellOnce()
    if (!ringTimerRef.current) {
      ringTimerRef.current = setInterval(ringBellOnce, 2500)
    }
  }

  const acknowledgeBell = () => {
    stopRinging()
  }

  const submitSurvey = async () => {
    acknowledgeBell()
    setShowSurvey(false)

    // Compute session trees and persist score immediately
    const totalSeconds = Math.max(0, Math.min(300, durationMinutes)) * 60
    const elapsed = totalSeconds - timeLeft
    let sessionTrees = Math.max(0, Math.floor(elapsed / 15))
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('forest_score', String(sessionTrees))
      }
    } catch {}

    // Prepare full CSV with pre + post stats
    const startedAt = sessionStartTime?.toISOString() || ''
    const endedAt = new Date().toISOString()
    const subjectNameRaw = selectedSubjectId ? (subjects.find(s => s.id === selectedSubjectId)?.name || '') : (customSubject || '')
    const subjectLower = subjectNameRaw.toLowerCase()
    const headers = [
      'date','started_at','ended_at','user_id','subject','subject_id','duration_minutes','duration_seconds','energy_before','goal','exam_soon','reached_goal','happiness','energy_after','breaks','hardness','next_plan','forest_trees'
    ]
    const dateOnly = endedAt.slice(0,10)
    const mergedBreaks = Array.from(new Set([...(currentSessionBreaks||[]), ...((survey.breaks||[]))]))
    const rowVals = [
      dateOnly,
      startedAt,
      endedAt,
      user?.id || '',
      subjectLower,
      selectedSubjectId || '',
      Math.round(elapsed/60),
      elapsed,
      energyLevel,
      sessionGoal || '',
      examSoon ? 'yes' : 'no',
      survey.reachedGoal ? 'yes' : 'no',
      survey.happiness,
      survey.energyAfter,
      mergedBreaks.join('; '),
      survey.hardness,
      survey.nextPlan || '',
      sessionTrees
    ] as (string|number)[]
    const csvLine = (vals: any[]) => vals.map(v => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }).join(',')
    const csv = headers.join(',') + '\n' + csvLine(rowVals) + '\n'

    // Merge into a single master CSV in Bank (Home/study_sessions.csv)
    try {
      const current = mockBankData.slice()
      // Find Home folder
      const home = current.find(it => it.id === 'home' && it.type === 'folder') as FileOrFolder | undefined
      if (home) {
        let master = (home.items || []).find(it => it.type === 'file' && it.name === 'study_sessions.csv')
        const headerLine = headers.join(',') + '\r\n'
        if (!master) {
          master = { id: `file-${Date.now()}`, name: 'study_sessions.csv', type: 'file', content: headerLine, mime: 'text/csv' }
          home.items = [master, ...(home.items || [])]
        }
        const line = csvLine(rowVals) + '\r\n'
        master.content = (master.content || headerLine)
        // Ensure header exists exactly once
        if (!master.content.startsWith(headerLine)) master.content = headerLine + master.content
        master.content += line
        updateBankData(current)
        try { localStorage.setItem('bankData', JSON.stringify(current)) } catch {}
        // Also trigger a user download of the updated master CSV for external editing
        try {
          const blob = new Blob([master.content], { type: 'text/csv;charset=utf-8' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = 'study_sessions.csv'
          document.body.appendChild(a); a.click(); a.remove();
        } catch {}
      }
    } catch {}

    // Fire-and-forget persistence so navigation is instant
    if (user?.id) {
      try {
        if (survey.breaks?.length) {
          const merged = Array.from(new Set([...(savedBreaks||[]), ...survey.breaks]))
          setSavedBreaks(merged)
          localStorage.setItem('studyBreaks', JSON.stringify(merged))
        }
        const payload = {
          user_id: user.id,
          subject_id: selectedSubjectId || null,
          subject_name: subjectLower,
          reached_goal: survey.reachedGoal,
          happiness: survey.happiness,
          energy_after: survey.energyAfter,
          breaks: mergedBreaks,
          hardness: survey.hardness,
          next_plan: survey.nextPlan || null,
          created_at: endedAt
        }
        void supabase.from('study_session_surveys').insert(payload)
        // Also upload CSV to Supabase Storage bank bucket
        const blob = new Blob([csv], { type: 'text/csv' })
        const safeSubject = (subjectLower || 'general').replace(/[^a-z0-9-_]+/gi, '_')
        const path = `study_sessions/${safeSubject}/study_${safeSubject}_${dateOnly}.csv`
        void supabase.storage.from('bank').upload(path, blob, { upsert: true, contentType: 'text/csv' })
        // Also log a completed calendar event here (in case timer wasn’t auto-finish path)
        const calId = `done-session-${Date.now()}`
        const calRow = {
          id: calId,
          user_id: user.id,
          title: `Study: ${subjectLower || 'session'} (done)`,
          description: sessionGoal ? `Goal: ${sessionGoal}` : null,
          start: startedAt || endedAt,
          end: endedAt,
          all_day: false,
          tags: ['study','done']
        }
        void supabase.from('calendar_events').upsert(calRow)
        try {
          const cached = localStorage.getItem('calendar_events')
          const arr = cached ? JSON.parse(cached) : []
          arr.push({ id: calRow.id, title: calRow.title, description: calRow.description || undefined, start: new Date(calRow.start), end: new Date(calRow.end), allDay: false, tags: calRow.tags })
          localStorage.setItem('calendar_events', JSON.stringify(arr))
        } catch {}
      } catch (e) {
        console.error('Failed to save survey or upload CSV', e)
      }
    }

    // Reset and navigate immediately
    resetSession()
    try { router.replace('/study-timer') } catch {}
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getEnergyLevelInfo = () => {
    return energyLevels.find(level => level.value === energyLevel) || energyLevels[2]
  }

  const energyInfo = getEnergyLevelInfo()

  const elapsedSeconds = Math.max(0, Math.min(300, durationMinutes)) * 60 - timeLeft
  const sessionTrees = Math.max(0, Math.floor(elapsedSeconds / 15))
  const liveForestScore = (typeof window === 'undefined') ? 0 : (isRunning ? sessionTrees : (parseInt((typeof window !== 'undefined' && localStorage.getItem('forest_score')) || '0', 10) || 0))

  // Draggable timer cube
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [timerPos, setTimerPos] = useState({ x: 16, y: 16 })
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  const onTimerMouseDown = (e: React.MouseEvent) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragRef.current = { dx: e.clientX - box.left, dy: e.clientY - box.top }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const nx = Math.min(rect.right - rect.left - 96, Math.max(0, ev.clientX - rect.left - dragRef.current.dx))
      const ny = Math.min(rect.bottom - rect.top - 96, Math.max(0, ev.clientY - rect.top - dragRef.current.dy))
      setTimerPos({ x: nx, y: ny })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (isRunning) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 text-2xl font-bold text-green-800">
          <LeafIcon className="w-8 h-8" />
          Study Timer
          <span className="ml-2 text-base font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">Forest Score: {liveForestScore}</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Card className="border-2 border-green-200 overflow-hidden">
            <div ref={containerRef} className="relative h-[72vh] bg-gradient-to-br from-green-50 to-emerald-100">
              {/* Forest overlay */}
              <Forest elapsedSeconds={Math.max(0, Math.min(300, durationMinutes)) * 60 - timeLeft} burning={blowForest} />

              {/* Stop button while running */}
              <div className="absolute top-3 right-3 z-10">
                <Button onClick={resetSession} variant="outline" className="border-red-200 text-red-700 bg-white/90">Stop Session</Button>
              </div>

              {/* Tiny timer cube (draggable) */}
              <div
                className="absolute w-24 h-24 bg-white/90 backdrop-blur rounded-md shadow grid place-items-center cursor-move select-none"
                style={{ left: timerPos.x, top: timerPos.y }}
                onMouseDown={onTimerMouseDown}
              >
                <div className="text-lg font-semibold">
                  {`${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(timeLeft%60).padStart(2,'0')}`}
                </div>
              </div>

            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Pre-session view (not running)
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 text-2xl font-bold text-green-800">
        <LeafIcon className="w-8 h-8" />
        Study Timer
        <span className="ml-2 text-base font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">Forest Score: {liveForestScore}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Timer */}
          <Card className="relative overflow-hidden border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            {/* Background disabled per request */}
            <div className="relative z-10">
              <CardHeader className="text-center">
                <CardTitle className="text-green-800">Focus Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Focus scene and sounds, shown when running */}
                {isRunning && (
                  <div>
                    {/* Inline focus player with video background */}
                    <FocusInline showVideo={true} />
                  </div>
                )}
                {/* Sound unlock/test and performance toggle */}
                {!showBreak && (
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={async()=>{ try { await audioCtxRef.current?.resume(); await audioRef.current?.play(); audioRef.current?.pause(); } catch {} }}>Enable sound</Button>
                  </div>
                )}
                {!showBreak && (
                  <div className="flex flex-col items-center gap-4">
                    <TimerCircle 
                      duration={Math.max(0, Math.min(300, durationMinutes)) * 60}
                      isPaused={!isRunning}
                      onFinish={handleSessionComplete}
                      timeLeftSeconds={timeLeft}
                    />
                    {/* Duration selection */}
                    <div className="w-full max-w-md">
                      <label className="text-sm font-medium text-green-700">Duration (minutes)</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="range" min={0} max={300} value={durationMinutes} onChange={(e)=>setDurationMinutes(parseInt(e.target.value||'0'))} className="w-full" />
                        <Input type="number" min={0} max={300} value={durationMinutes} onChange={(e)=>setDurationMinutes(Number(e.target.value))} className="w-24" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">0 to 300 minutes (5 hours)</p>
                    </div>
                  </div>
                )}

              {!showBreak && (
                <div className="space-y-4">
                  {/* Subject Selection or custom */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-green-700">Subject</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Select value={selectedSubjectId} onValueChange={(v)=>{ setSelectedSubjectId(v); setCustomSubject(''); }}>
                        <SelectTrigger className="border-green-200">
                          <SelectValue placeholder="Choose from your subjects" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Or type a custom subject" value={customSubject} onChange={(e)=>{ setCustomSubject(e.target.value); setSelectedSubjectId(''); }} className="border-green-200" />
                    </div>
                    {/* Exam soon prompt */}
                    {(selectedSubjectId || customSubject) && (
                      <div className="text-xs text-green-700 mt-1">
                        {(() => {
                          const subj = subjects.find(s => s.id === selectedSubjectId)
                          if (subj?.examDate) {
                            const days = Math.ceil((new Date(subj.examDate).getTime() - Date.now()) / (1000*60*60*24))
                            return (
                              <div className="flex items-center gap-2">
                                <span>Exam in {days} days.</span>
                                <label className="inline-flex items-center gap-1">
                                  <input type="checkbox" checked={!!examSoon} onChange={e=>setExamSoon(e.target.checked)} />
                                  Focus on this for the session?
                                </label>
                              </div>
                            )
                          }
                          return (
                            <label className="inline-flex items-center gap-1">
                              <input type="checkbox" checked={!!examSoon} onChange={e=>setExamSoon(e.target.checked)} />
                              Is there an exam soon for this subject?
                            </label>
                          )
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Session Goal */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-green-700">Session Goal</label>
                    <Input value={sessionGoal} onChange={(e)=>setSessionGoal(e.target.value)} placeholder="e.g., Finish chapter 3 exercises" className="border-green-200" />
                  </div>


                  {/* Energy Level */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-green-700">Energy Level</label>
                    <div className="flex gap-2">
                      {energyLevels.map(level => (
                        <Button
                          key={level.value}
                          variant={energyLevel === level.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEnergyLevel(level.value)}
                          className={cn(
                            energyLevel === level.value 
                              ? level.bg + ' ' + level.color + ' border-current'
                              : 'border-green-200'
                          )}
                        >
                          {level.value}
                        </Button>
                      ))}
                    </div>
                    <p className={cn("text-xs", energyInfo.color)}>
                      {energyInfo.label} energy
                    </p>
                  </div>


                  

                  {/* Controls */}
                  <div className="flex gap-2 justify-center">
                    {!isRunning ? (
                      <Button 
                        onClick={startSession}
                        disabled={!(selectedSubjectId || customSubject)}
                        className="bg-green-600 hover:bg-green-700 text-white px-8"
                      >
                        Start Session
                      </Button>
                    ) : (
                      <Button 
                        onClick={pauseSession}
                        variant="outline"
                        className="border-green-200 text-green-700"
                      >
                        Pause
                      </Button>
                    )}
                    <Button 
                      onClick={resetSession}
                      variant="outline"
                      className="border-red-200 text-red-700"
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              )}

              {/* Break & Survey */}
              {showBreak && (
                <div className="text-center space-y-4">
                  <h3 className="text-xl font-semibold text-green-800">Session Complete!</h3>
                  <p className="text-green-700">Great job! Please answer a few quick questions.</p>

                  {/* Survey */}
                  {showSurvey && (
                    <div className="text-left max-w-xl mx-auto space-y-4">
                      <div className="flex items-center justify-between">
                        <label>Did you reach your set goal?</label>
                        <Select value={survey.reachedGoal ? 'yes' : 'no'} onValueChange={(v)=>setSurvey(prev=>({...prev, reachedGoal: v==='yes'}))}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label>Happiness (1-5)</label>
                          <Input type="number" min={1} max={5} value={survey.happiness} onChange={(e)=>setSurvey(p=>({...p, happiness: Math.min(5, Math.max(1, Number(e.target.value))) as 1|2|3|4|5}))} />
                        </div>
                        <div>
                          <label>Energy now (1-5)</label>
                          <Input type="number" min={1} max={5} value={survey.energyAfter} onChange={(e)=>setSurvey(p=>({...p, energyAfter: Math.min(5, Math.max(1, Number(e.target.value))) as 1|2|3|4|5}))} />
                        </div>
                      </div>

                      <div>
                        <label className="block">Breaks taken this session</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {Array.from(new Set(['drink/eat','social','power nap','hobby','phone','artistic','study together', ...(savedBreaks||[])])).map(b => (
                            <Button key={b} type="button" variant={survey.breaks.includes(b) ? 'default' : 'outline'} size="sm" onClick={()=>setSurvey(p=>({...p, breaks: p.breaks.includes(b) ? p.breaks.filter(x=>x!==b) : [...p.breaks, b]}))}>{b}</Button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Input placeholder="Add another break label and press Enter" onKeyDown={(e)=>{
                            if (e.key==='Enter') {
                              const val = (e.target as HTMLInputElement).value.trim()
                              if (val) {
                                setSurvey(p=>({...p, breaks: Array.from(new Set([...(p.breaks||[]), val])) }))
                                ;(e.target as HTMLInputElement).value=''
                              }
                            }
                          }} />
                        </div>
                      </div>

                      <div>
                        <label>How hard was the study session (1-5)</label>
                        <Input type="number" min={1} max={5} value={survey.hardness} onChange={(e)=>setSurvey(p=>({...p, hardness: Math.min(5, Math.max(1, Number(e.target.value))) as 1|2|3|4|5}))} />
                      </div>

                      <div>
                        <label>What will you do next time studying this subject?</label>
                        <Textarea value={survey.nextPlan} onChange={(e)=>setSurvey(p=>({...p, nextPlan: e.target.value}))} rows={3} />
                      </div>

                      <div className="flex justify-center gap-2">
                        <Button onClick={submitSurvey} className="bg-green-600 hover:bg-green-700 text-white">Save Answers</Button>
                        <Button onClick={acknowledgeBell} variant="outline">Mute Bell</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </CardContent>
            </div>
          </Card>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Session Stats */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800">Session Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Forest Score</span>
                <span className="text-sm font-medium text-green-700">{liveForestScore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Time Studied</span>
                <span className="text-sm font-medium text-blue-700">
                  {formatTime(Math.max(0, Math.min(300, durationMinutes)) * 60 - timeLeft)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Energy Level</span>
                <Badge className={cn("text-xs", energyInfo.bg, energyInfo.color)}>
                  {energyInfo.label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-800">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessionHistory.slice(0, 5).map(session => (
                <div key={session.id} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-purple-800">{session.subject}</span>
                    <span className="text-xs text-purple-600">
                      {formatTime(session.duration)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-600">
                      {new Date(session.timestamp as any).toLocaleDateString()}
                    </span>
                    <Badge variant="outline" className="text-xs bg-purple-100 border-purple-300 text-purple-700">
                      {Math.round(session.productivity * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {sessionHistory.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">
                  No sessions yet. Start studying to see your history!
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
