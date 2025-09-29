'use client'

import React from 'react'
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
  Plus
} from 'lucide-react'
import Link from 'next/link'

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
    settings: <MiniSettingsWidget />
  }

  return widgets[type as keyof typeof widgets] || <div>Widget not found</div>
} 