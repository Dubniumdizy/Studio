'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Target, 
  Timer, 
  BookOpen, 
  FileText, 
  Brain, 
  BarChart3, 
  CheckCircle,
  Clock,
  TrendingUp,
  Leaf,
  Sparkles,
  Bot,
  Settings,
  Plus,
  HelpCircle,
  Trash2,
  Check
} from 'lucide-react'
import Link from 'next/link'
import DatabaseService from '@/lib/database'
import { supabase } from '@/lib/supabaseClient'
import { getSubjects as getLocalSubjects } from '@/lib/subjects'

// Mini Calendar Widget
export function MiniCalendarWidget() {
  const today = new Date()
  const events = [
    { id: '1', title: 'Study Session', time: '09:00', type: 'study' },
    { id: '2', title: 'Team Meeting', time: '14:00', type: 'meeting' },
    { id: '3', title: 'Break', time: '11:30', type: 'break' }
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Today's Schedule</h3>
        <Link href="/calendar">
          <Button variant="ghost" size="sm">
            <Calendar className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {events.slice(0, 3).map(event => (
          <div key={event.id} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span className="text-muted-foreground">{event.time}</span>
            <span className="truncate">{event.title}</span>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full">
        <Plus className="h-3 w-3 mr-1" />
        Add Event
      </Button>
    </div>
  )
}

// Mini Goals Widget
export function MiniGoalsWidget() {
  const goals = [
    { id: '1', title: 'Read Chapter 5', progress: 75, due: 'Today' },
    { id: '2', title: 'Practice Problems', progress: 30, due: 'Tomorrow' },
    { id: '3', title: 'Review Notes', progress: 100, due: 'Completed' }
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Weekly Goals</h3>
        <Link href="/goals">
          <Button variant="ghost" size="sm">
            <Target className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {goals.map(goal => (
          <div key={goal.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate">{goal.title}</span>
              <span className="text-muted-foreground">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} className="h-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Mini Study Timer Widget
export function MiniStudyTimerWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Study Timer</h3>
        <Link href="/study-timer">
          <Button variant="ghost" size="sm">
            <Timer className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="text-center space-y-2">
        <div className="text-2xl font-bold text-primary">25:00</div>
        <div className="text-xs text-muted-foreground">Pomodoro Session</div>
        <Button size="sm" className="w-full">
          Start Session
        </Button>
      </div>
    </div>
  )
}

// Mini Notes Widget
export function MiniNotesWidget() {
  const recentNotes = [
    { id: '1', title: 'Math Formulas', updated: '2h ago' },
    { id: '2', title: 'Study Plan', updated: '1d ago' },
    { id: '3', title: 'Lecture Notes', updated: '3d ago' }
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Recent Notes</h3>
        <Link href="/notes">
          <Button variant="ghost" size="sm">
            <FileText className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {recentNotes.map(note => (
          <div key={note.id} className="flex items-center justify-between text-xs">
            <span className="truncate">{note.title}</span>
            <span className="text-muted-foreground">{note.updated}</span>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full">
        <Plus className="h-3 w-3 mr-1" />
        New Note
      </Button>
    </div>
  )
}

// Mini Analytics Widget
export function MiniAnalyticsWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">This Week</h3>
        <Link href="/analytics">
          <Button variant="ghost" size="sm">
            <BarChart3 className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-center">
          <div className="text-lg font-bold text-primary">12h</div>
          <div className="text-muted-foreground">Study Time</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">85%</div>
          <div className="text-muted-foreground">Goals Met</div>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        <span>+15% from last week</span>
      </div>
    </div>
  )
}

// Mini Flashcards Widget
export function MiniFlashcardsWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Flashcards</h3>
        <Link href="/flashcards">
          <Button variant="ghost" size="sm">
            <Brain className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="text-center space-y-2">
        <div className="text-2xl font-bold text-primary">24</div>
        <div className="text-xs text-muted-foreground">Cards Due Today</div>
        <Button size="sm" className="w-full">
          Review Now
        </Button>
      </div>
    </div>
  )
}

// Mini Resources Widget
export function MiniResourcesWidget() {
  const resources = [
    { id: '1', name: 'Wolfram Alpha', type: 'tool' },
    { id: '2', name: 'Study Music', type: 'spotify' },
    { id: '3', name: 'Course Book', type: 'pdf' }
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Quick Resources</h3>
        <Link href="/resources">
          <Button variant="ghost" size="sm">
            <BookOpen className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {resources.map(resource => (
          <div key={resource.id} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="truncate">{resource.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Mini AI Friend Widget
export function MiniAIFriendWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">AI Study Buddy</h3>
        <Link href="/study-buddy">
          <Button variant="ghost" size="sm">
            <Bot className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="text-center space-y-2">
        <div className="text-xs text-muted-foreground">
          "Ready to help with your studies! 🌱"
        </div>
        <Button size="sm" className="w-full">
          Ask for Help
        </Button>
      </div>
    </div>
  )
}

// Mini Inspiration Widget
export function MiniInspirationWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Daily Inspiration</h3>
        <Link href="/inspiration">
          <Button variant="ghost" size="sm">
            <Sparkles className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="text-center space-y-2">
        <div className="text-xs text-muted-foreground italic">
          "Every expert was once a beginner. Keep growing! 🌿"
        </div>
        <Button size="sm" variant="outline" className="w-full">
          Get Motivated
        </Button>
      </div>
    </div>
  )
}

// Mini Overwhelmed Widget
export function MiniOverwhelmedWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Feeling Overwhelmed</h3>
        <Link href="/study-buddy">
          <Button variant="ghost" size="sm">
            <Brain className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        <ul className="list-disc pl-4 space-y-1">
          <li>Consider taking the course later (omtentaperiod or next year).</li>
          <li>Skim the solution sheet first to memorize key ideas.</li>
          <li>Use the Study Buddy in this app to plan a minimal path.</li>
          <li>Hire a guide/tutor for focused help (e.g., Superproof).</li>
        </ul>
      </div>
      <div className="flex gap-2">
        <Link href="/study-buddy" className="w-full">
          <Button size="sm" className="w-full">Open Study Buddy</Button>
        </Link>
      </div>
    </div>
  )
}

// Mini Checklist Widget
export function MiniChecklistWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Exam Day Checklist</h3>
      </div>
      <div className="text-xs">
        <ul className="list-disc pl-4 space-y-1">
          <li>ID</li>
          <li>Pen and eraser</li>
          <li>Calculator (if allowed)</li>
          <li>Food and drinks</li>
          <li>Rest well the day before (maybe do not study)</li>
        </ul>
      </div>
    </div>
  )
}

// Mini Questions Widget (subject-specific questions to ask later)
export function MiniQuestionsWidget() {
  type SubjectOpt = { id: string; name: string }
  type QuestionItem = { id: string; text: string; createdAt: string; resolved?: boolean }
  const STORE_KEY = 'subject_questions_store'

  const [subjects, setSubjects] = useState<SubjectOpt[]>([])
  const [selected, setSelected] = useState<string>('')
  const [text, setText] = useState('')
  const [store, setStore] = useState<Record<string, QuestionItem[]>>({})

  // Load subjects (Supabase if signed in; fallback to local mock subjects)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const uid = data?.session?.user?.id
        if (uid) {
          try {
            const rows = await DatabaseService.getSubjects(uid as any)
            const opts = (rows || []).map((r: any) => ({ id: r.id, name: r.name || 'Untitled' }))
            setSubjects(opts)
            if (!selected && opts.length) setSelected(opts[0].id)
            return
          } catch {}
        }
      } catch {}
      try {
        const locals = getLocalSubjects().map(s => ({ id: s.id, name: s.name }))
        setSubjects(locals)
        if (!selected && locals.length) setSelected(locals[0].id)
      } catch { setSubjects([]) }
    })()
  }, [])

  // Load/save questions store
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      setStore(raw ? JSON.parse(raw) : {})
    } catch { setStore({}) }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)) } catch {}
  }, [store])

  const list: QuestionItem[] = useMemo(() => store[selected] || [], [store, selected])

  const addQuestion = () => {
    const t = text.trim()
    if (!selected || !t) return
    const item: QuestionItem = { id: `q-${Date.now()}`, text: t, createdAt: new Date().toISOString(), resolved: false }
    setStore(prev => ({ ...prev, [selected]: [item, ...(prev[selected] || [])] }))
    setText('')
  }
  const removeQuestion = (id: string) => {
    setStore(prev => ({ ...prev, [selected]: (prev[selected] || []).filter(q => q.id !== id) }))
  }
  const toggleResolved = (id: string) => {
    setStore(prev => ({ ...prev, [selected]: (prev[selected] || []).map(q => q.id===id ? { ...q, resolved: !q.resolved } : q) }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Questions to Ask</h3>
      </div>
      {subjects.length === 0 ? (
        <div className="text-xs text-muted-foreground">No subjects found. Create a subject first.</div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <select
              className="w-full border rounded px-2 py-1 text-xs bg-background"
              value={selected}
              onChange={e => setSelected(e.target.value)}
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <textarea
              className="w-full border rounded px-2 py-1 text-xs min-h-[60px]"
              placeholder="Write a question you want to remember to ask later..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <Button size="sm" className="w-full" onClick={addQuestion}>
              <HelpCircle className="h-3 w-3 mr-1" /> Save Question
            </Button>
          </div>
          <div className="space-y-2">
            {list.length === 0 ? (
              <div className="text-xs text-muted-foreground">No saved questions for this subject yet.</div>
            ) : (
              <ul className="space-y-2">
                {list.map(q => (
                  <li key={q.id} className="p-2 border rounded text-xs flex items-start justify-between gap-2 bg-muted/30">
                    <div>
                      <div className={q.resolved ? 'line-through text-muted-foreground' : ''}>{q.text}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{new Date(q.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleResolved(q.id)} title={q.resolved ? 'Mark as open' : 'Mark as resolved'}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQuestion(q.id)} title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Mini Settings Widget
export function MiniSettingsWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Quick Settings</h3>
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>Dark Mode</span>
          <Badge variant="secondary">On</Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span>Notifications</span>
          <Badge variant="secondary">On</Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span>Sound</span>
          <Badge variant="outline">Off</Badge>
        </div>
      </div>
    </div>
  )
}

// Widget factory function
export function createMiniWidget(type: string, props?: any) {
  const widgets = {
    calendar: <MiniCalendarWidget />,
    goals: <MiniGoalsWidget />,
    timer: <MiniStudyTimerWidget />,
    notes: <MiniNotesWidget />,
    analytics: <MiniAnalyticsWidget />,
    flashcards: <MiniFlashcardsWidget />,
    resources: <MiniResourcesWidget />,
    ai: <MiniAIFriendWidget />,
    inspiration: <MiniInspirationWidget />,
    overwhelmed: <MiniOverwhelmedWidget />,
    checklist: <MiniChecklistWidget />,
    questions: <MiniQuestionsWidget />,
    settings: <MiniSettingsWidget />
  }

  return widgets[type as keyof typeof widgets] || <div>Widget not found</div>
}
