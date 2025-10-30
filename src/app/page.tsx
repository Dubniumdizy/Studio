'use client'

import React, { useState, useEffect, useRef } from 'react'
import { WidgetGrid } from '@/components/dashboard/WidgetGrid'
import { 
  createMiniWidget,
  MiniCalendarWidget,
  MiniGoalsWidget,
  MiniStudyTimerWidget,
  MiniNotesWidget,
  MiniAnalyticsWidget,
  MiniFlashcardsWidget,
  MiniResourcesWidget,
  MiniAIFriendWidget,
  MiniInspirationWidget,
  MiniOverwhelmedWidget,
  MiniChecklistWidget,
  MiniQuestionsWidget,
  MiniSettingsWidget
} from '@/components/dashboard/MiniWidgets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Settings, Leaf, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useDemoMode, useDemoWidgetInteractions } from '@/hooks/use-demo-mode'
import { useWidgetPersistence, useDashboardSettings } from '@/hooks/use-widget-persistence'
import { useAuth } from '@/hooks/use-auth'

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

// Widget type to component mapping
const widgetTypes = {
  calendar: { title: 'Calendar', component: <MiniCalendarWidget /> },
  goals: { title: 'Goals', component: <MiniGoalsWidget /> },
  timer: { title: 'Study Timer', component: <MiniStudyTimerWidget /> },
  notes: { title: 'Notes', component: <MiniNotesWidget /> },
  analytics: { title: 'Analytics', component: <MiniAnalyticsWidget /> },
  flashcards: { title: 'Flashcards', component: <MiniFlashcardsWidget /> },
  resources: { title: 'Resources', component: <MiniResourcesWidget /> },
  ai: { title: 'AI Study Buddy', component: <MiniAIFriendWidget /> },
  inspiration: { title: 'Inspiration', component: <MiniInspirationWidget /> },
  overwhelmed: { title: 'Overwhelmed', component: <MiniOverwhelmedWidget /> },
  checklist: { title: 'Checklist', component: <MiniChecklistWidget /> },
  questions: { title: 'Questions', component: <MiniQuestionsWidget /> },
  settings: { title: 'Settings', component: <MiniSettingsWidget /> }
};

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

export default function HomePage() {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [showWidgetMenu, setShowWidgetMenu] = useState(false)
  const [headerImage, setHeaderImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const headerHidden = useHideOnScroll();
  const { isDemo } = useDemoMode();
  const { activeWidget } = useDemoWidgetInteractions(isDemo);
  const { user } = useAuth();
  const { loadWidgets, saveWidgets, loading: widgetsLoading } = useWidgetPersistence('home');
  const { settings, saveSettings } = useDashboardSettings();

  // Load widgets from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        const loadedWidgets = await loadWidgets()
        
        if (loadedWidgets.length > 0) {
          // Reconstruct widgets with components
          setWidgets(loadedWidgets.map((w) => ({
            ...w,
            component: widgetTypes[w.type as keyof typeof widgetTypes]?.component || <div>Unknown Widget</div>
          })))
        } else {
          // Default widgets for new users
          const defaultWidgets = [
            {
              id: 'calendar',
              type: 'calendar',
              title: 'Calendar',
              component: <MiniCalendarWidget />,
              locked: false,
              minimized: false,
              x: 0,
              y: 0,
              w: 4,
              h: 3
            },
            {
              id: 'goals',
              type: 'goals',
              title: 'Goals',
              component: <MiniGoalsWidget />,
              locked: false,
              minimized: false,
              x: 4,
              y: 0,
              w: 4,
              h: 3
            },
            {
              id: 'timer',
              type: 'timer',
              title: 'Study Timer',
              component: <MiniStudyTimerWidget />,
              locked: false,
              minimized: false,
              x: 8,
              y: 0,
              w: 4,
              h: 3
            },
            {
              id: 'analytics',
              type: 'analytics',
              title: 'Analytics',
              component: <MiniAnalyticsWidget />,
              locked: false,
              minimized: false,
              x: 0,
              y: 3,
              w: 6,
              h: 3
            },
            {
              id: 'ai',
              type: 'ai',
              title: 'AI Study Buddy',
              component: <MiniAIFriendWidget />,
              locked: false,
              minimized: false,
              x: 6,
              y: 3,
              w: 6,
              h: 3
            }
          ]
          setWidgets(defaultWidgets)
          // Save default widgets to database
          await saveWidgets(defaultWidgets)
        }
      } catch (error) {
        console.error('Error loading widgets:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user, loadWidgets, saveWidgets])

  // Load header image from settings
  useEffect(() => {
    if (settings?.header_image) {
      setHeaderImage(settings.header_image)
    }
  }, [settings])

  // Auto-save widgets to Supabase when they change (debounced)
  useEffect(() => {
    if (!user || isLoading || widgets.length === 0) return

    const timeoutId = setTimeout(() => {
      saveWidgets(widgets)
    }, 1000) // Debounce for 1 second

    return () => clearTimeout(timeoutId)
  }, [widgets, user, isLoading, saveWidgets])

  const addWidget = (type: keyof typeof widgetTypes) => {
    const widgetType = widgetTypes[type]
    if (widgetType) {
      const newWidget: Widget = {
        id: `${type}-${Date.now()}`,
        type,
        title: widgetType.title,
        component: widgetType.component,
        locked: false,
        minimized: false,
        x: 0,
        y: 0,
        w: 4,
        h: 3
      }
      setWidgets([...widgets, newWidget])
    }
    setShowWidgetMenu(false)
  }

  const handleWidgetChange = (newWidgets: Widget[]) => {
    setWidgets(newWidgets)
  }

  const handleHeaderImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const imageData = ev.target?.result as string
        setHeaderImage(imageData)
        // Save to Supabase
        if (user) {
          await saveSettings({ ...settings, header_image: imageData })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5ede3] via-[#e6e1d3] to-[#d6cfc2]">
      {/* Optional Header Image/GIF */}
      <div className={`relative h-64 bg-forest-gradient overflow-hidden flex items-center justify-center transition-transform duration-300 ${headerHidden ? '-translate-y-full opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {headerImage ? (
          <img src={headerImage} alt="Header" className="absolute inset-0 w-full h-full object-cover object-center opacity-80" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-lg italic opacity-60">
            Add a header image or GIF for inspiration
          </div>
        )}
        <div className="absolute top-4 right-4 z-20">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Upload Header Image/GIF
          </Button>
          <input
            type="file"
            accept="image/*,image/gif"
            ref={fileInputRef}
            className="hidden"
            onChange={handleHeaderImageChange}
          />
        </div>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl font-headline font-bold mb-2 float-animation drop-shadow-lg">
              Studyverse Garden
            </h1>
            <p className="text-lg opacity-90 leaf-sway drop-shadow">
              Your cozy corner for learning and growth
            </p>
          </div>
        </div>
        {/* Animated nature elements (subtle, no emojis) */}
        <div className="absolute top-4 left-4 text-white/60">
          <Leaf className="h-6 w-6 leaf-sway" />
        </div>
        <div className="absolute top-8 right-8 text-white/60">
          <Sparkles className="h-6 w-6 pulse-soft" />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-headline font-semibold text-gray-800">
              Your Garden Dashboard
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWidgetMenu(!showWidgetMenu)}
                className="hover-gentle"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
              <Link href="/settings">
                <Button variant="ghost" className="hover-gentle">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Widget Menu */}
          {showWidgetMenu && (
            <Card className="mb-4 shadow-cottage">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-3">Choose a Widget</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { type: 'calendar', label: 'Calendar' },
                    { type: 'goals', label: 'Goals' },
                    { type: 'timer', label: 'Study Timer' },
                    { type: 'notes', label: 'Notes' },
                    { type: 'analytics', label: 'Analytics' },
                    { type: 'flashcards', label: 'Flashcards' },
                    { type: 'resources', label: 'Resources' },
                    { type: 'ai', label: 'AI Buddy' },
                    { type: 'inspiration', label: 'Inspiration' },
                    { type: 'overwhelmed', label: 'Overwhelmed' },
                    { type: 'checklist', label: 'Checklist' },
                    { type: 'questions', label: 'Questions' },
                    { type: 'settings', label: 'Settings' }
                  ].map(({ type, label }) => (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => addWidget(type as keyof typeof widgetTypes)}
                      className="hover-gentle text-xs"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Widget Grid */}
        {widgets.length > 0 ? (
          <WidgetGrid
            widgets={widgets}
            onWidgetChange={(newWidgets: Widget[]) => handleWidgetChange(newWidgets)}
            className="min-h-[600px]"
          />
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 text-muted-foreground">No widgets yet</div>
            <h3 className="text-xl font-headline mb-2">Welcome to your garden!</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding some widgets to personalize your dashboard.
            </p>
            <Button onClick={() => setShowWidgetMenu(true)} className="hover-gentle">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Widget
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
