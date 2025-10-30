'use client'

import React, { useState, useCallback } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { Lock, Unlock, Maximize2, Minimize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AIFriendWidget } from './ai-friend-widget'
import { NotesWidget } from './notes-widget'
import { TodoListWidget } from './todo-list-widget'
import { CalendarWidget } from './calendar-widget'
import { StatsWidget } from './stats-widget'
import { StudyTimerWidget } from './study-timer-widget'
import { QuickLinksWidget } from './quick-links-widget'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface Widget {
  id: string
  type: string
  title: string
  component: React.ReactNode
  locked: boolean
  minimized: boolean
  x: number
  y: number
  w: number
  h: number
}

interface WidgetGridProps {
  widgets: Widget[]
  onWidgetChange: (widgets: Widget[]) => void
  className?: string
}

type WidgetKey = 'notes' | 'todo' | 'calendar' | 'stats' | 'studyTimer' | 'quickLinks' | 'aiFriend'

interface WidgetDefinition {
  name: string
  description: string
  icon: string
  defaultSize: { w: number; h: number }
}

export function WidgetGrid({ widgets, onWidgetChange, className }: WidgetGridProps) {
  const [layouts, setLayouts] = useState({})

  const handleLayoutChange = useCallback((currentLayout: any, allLayouts: any) => {
    setLayouts(allLayouts)
    
    const updatedWidgets = widgets.map(widget => {
      const layout = allLayouts.lg?.find((item: any) => item.i === widget.id)
      if (layout) {
        return {
          ...widget,
          x: layout.x,
          y: layout.y,
          w: layout.w,
          h: layout.h
        }
      }
      return widget
    })
    
    onWidgetChange(updatedWidgets)
  }, [widgets, onWidgetChange])

  const toggleLock = (widgetId: string) => {
    const updatedWidgets = widgets.map(widget =>
      widget.id === widgetId ? { ...widget, locked: !widget.locked } : widget
    )
    onWidgetChange(updatedWidgets)
  }

  const toggleMinimize = (widgetId: string) => {
    const updatedWidgets = widgets.map(widget =>
      widget.id === widgetId ? { ...widget, minimized: !widget.minimized } : widget
    )
    onWidgetChange(updatedWidgets)
  }

  const removeWidget = (widgetId: string) => {
    const updatedWidgets = widgets.filter(widget => widget.id !== widgetId)
    onWidgetChange(updatedWidgets)
  }

  const layout = widgets.map(widget => ({
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.minimized ? 1 : widget.h,
    static: widget.locked,
    isResizable: !widget.locked,
    isDraggable: !widget.locked
  }))

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        onLayoutChange={handleLayoutChange}
        isDraggable={true}
        isResizable={true}
        margin={[16, 16]}
        containerPadding={[16, 16]}
      >
        {widgets.map(widget => (
          <div key={widget.id} className="widget-container" data-widget-id={widget.id}>
            <Card className={cn(
              "h-full transition-all duration-300 hover-gentle",
              widget.locked && "ring-2 ring-primary/20",
              widget.minimized && "h-16"
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {widget.locked && <Lock className="h-3 w-3" />}
                    {widget.title}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLock(widget.id)}
                      className="h-6 w-6 p-0"
                    >
                      {widget.locked ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <Unlock className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMinimize(widget.id)}
                      className="h-6 w-6 p-0"
                    >
                      {widget.minimized ? (
                        <Maximize2 className="h-3 w-3" />
                      ) : (
                        <Minimize2 className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWidget(widget.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {!widget.minimized && (
                <CardContent className="pt-0">
                  {widget.component}
                </CardContent>
              )}
            </Card>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}

export const allWidgets: Record<WidgetKey, (id: string) => JSX.Element> = {
  notes: (_id: string) => <NotesWidget />,
  todo: (_id: string) => <TodoListWidget />,
  calendar: (_id: string) => <CalendarWidget />,
  stats: (_id: string) => <StatsWidget />,
  studyTimer: (_id: string) => <StudyTimerWidget />,
  quickLinks: (_id: string) => <QuickLinksWidget />,
  aiFriend: (id: string) => <AIFriendWidget id={id} />,
}

export const allWidgetDefs: Record<WidgetKey, WidgetDefinition> = {
  notes: {
    name: 'Notes',
    description: 'Quick access to your study notes',
    icon: '📝',
    defaultSize: { w: 6, h: 4 }
  },
  todo: {
    name: 'To-Do List',
    description: 'Manage your study tasks',
    icon: '✅',
    defaultSize: { w: 4, h: 4 }
  },
  calendar: {
    name: 'Calendar',
    description: 'View upcoming events and deadlines',
    icon: '📅',
    defaultSize: { w: 6, h: 4 }
  },
  stats: {
    name: 'Study Stats',
    description: 'Track your study progress',
    icon: '📊',
    defaultSize: { w: 4, h: 3 }
  },
  studyTimer: {
    name: 'Study Timer',
    description: 'Quick access to Pomodoro timer',
    icon: '⏱️',
    defaultSize: { w: 4, h: 3 }
  },
  quickLinks: {
    name: 'Quick Links',
    description: 'Fast access to study resources',
    icon: '🔗',
    defaultSize: { w: 4, h: 3 }
  },
  aiFriend: {
    name: 'AI Study Companion',
    description: 'Get personalized study advice',
    icon: '🌱',
    defaultSize: { w: 4, h: 5 }
  },
}

export type { WidgetKey, WidgetDefinition } 