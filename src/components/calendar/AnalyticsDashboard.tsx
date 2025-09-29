'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'
import { 
  Calendar, 
  Clock, 
  Target, 
  TrendingUp, 
  Zap, 
  Star, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Award,
  Settings,
  Tag,
  Flame,
  Brain,
  Heart,
  Coffee,
  Info
} from 'lucide-react'
import type { EnhancedCalendarEvent } from '@/types/enhanced-calendar'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface AnalyticsDashboardProps {
  events: EnhancedCalendarEvent[]
  selectedDate: Date
  tagWarningThreshold?: number
  onTagWarningThresholdChange?: (threshold: number) => void
}

const COLORS = {
  deep: '#3b82f6',
  shallow: '#10b981',
  break: '#f59e0b',
  personal: '#ef4444',
  energy1: '#ef4444',
  energy2: '#f97316',
  energy3: '#eab308',
  energy4: '#22c55e',
  energy5: '#10b981'
}

export function AnalyticsDashboard({ 
  events, 
  selectedDate, 
  tagWarningThreshold = 5,
  onTagWarningThresholdChange 
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week')
  const [showSettings, setShowSettings] = useState(false)
  const [openExplanation, setOpenExplanation] = useState<string | null>(null)

  const analytics = useMemo(() => {
    const startDate = startOfWeek(selectedDate)
    const endDate = endOfWeek(selectedDate)
    
    const filteredEvents = events.filter(event => {
      const eventStart = typeof event.start === 'string' ? new Date(event.start) : event.start
      return isWithinInterval(eventStart, { start: startDate, end: endDate })
    })

    // Basic stats
    const totalEvents = filteredEvents.length
    const completedEvents = filteredEvents.filter(event => event.checklist?.every(item => item.completed) || false).length
    const completionRate = totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0

    // Work type distribution
    const workTypeStats = filteredEvents.reduce((acc, event) => {
      acc[event.workType] = (acc[event.workType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Energy level distribution
    const energyStats = filteredEvents.reduce((acc, event) => {
      acc[event.energyLevel] = (acc[event.energyLevel] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    // Importance distribution
    const importanceStats = filteredEvents.reduce((acc, event) => {
      acc[event.importance] = (acc[event.importance] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    // Tag analysis
    const tagStats = filteredEvents.reduce((acc, event) => {
      event.tags?.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1
      })
      return acc
    }, {} as Record<string, number>)

    const tagWarnings = Object.entries(tagStats)
      .filter(([, count]) => count >= tagWarningThreshold)
      .sort(([, a], [, b]) => b - a)

    // Daily activity
    const daysOfWeek = eachDayOfInterval({ start: startDate, end: endDate })
    const dailyActivity = daysOfWeek.map(day => {
      const dayEvents = filteredEvents.filter(event => {
        const eventStart = typeof event.start === 'string' ? new Date(event.start) : event.start
        return isSameDay(eventStart, day)
      })
      
      return {
        day: format(day, 'EEE'),
        events: dayEvents.length,
        deepWork: dayEvents.filter(e => e.workType === 'deep').length,
        shallowWork: dayEvents.filter(e => e.workType === 'shallow').length,
        breaks: dayEvents.filter(e => e.workType === 'break').length,
        personal: dayEvents.filter(e => e.workType === 'personal').length
      }
    })

    // Time distribution
    const timeDistribution = Array.from({ length: 24 }, (_, hour) => {
      const hourEvents = filteredEvents.filter(event => {
        const eventStart = typeof event.start === 'string' ? new Date(event.start) : event.start
        return eventStart.getHours() === hour
      })
      
      return {
        hour: `${hour}:00`,
        events: hourEvents.length,
        energy: hourEvents.reduce((sum, e) => sum + e.energyLevel, 0) / (hourEvents.length || 1)
      }
    })

    // Habit tracking
    const habits = filteredEvents.filter(event => event.isHabit)
    const habitCompletion = habits.length > 0 ? 
      (habits.filter(h => h.checklist?.every(item => item.completed)).length / habits.length) * 100 : 0

    // Average energy and importance
    const avgEnergy = filteredEvents.length > 0 ? 
      filteredEvents.reduce((sum, e) => sum + e.energyLevel, 0) / filteredEvents.length : 0
    const avgImportance = filteredEvents.length > 0 ? 
      filteredEvents.reduce((sum, e) => sum + e.importance, 0) / filteredEvents.length : 0

    // Burnout risk analysis
    const highEnergyEvents = filteredEvents.filter(e => e.energyLevel >= 4).length
    const highImportanceEvents = filteredEvents.filter(e => e.importance >= 4).length
    const burnoutRisk = highEnergyEvents > 10 || highImportanceEvents > 8 ? 'high' : 
                       highEnergyEvents > 5 || highImportanceEvents > 4 ? 'medium' : 'low'

    // Wellness score
    const breakEvents = filteredEvents.filter(e => e.workType === 'break').length
    const personalEvents = filteredEvents.filter(e => e.workType === 'personal').length
    const wellnessScore = Math.min(100, Math.max(0, 
      (breakEvents * 10) + (personalEvents * 15) + (habitCompletion * 0.5)
    ))

    // Productivity score
    const deepWorkEvents = filteredEvents.filter(e => e.workType === 'deep').length
    const productivityScore = Math.min(100, Math.max(0,
      (completionRate * 0.4) + (deepWorkEvents * 5) + (avgEnergy * 10)
    ))

    return {
      totalEvents,
      completedEvents,
      completionRate,
      workTypeStats,
      energyStats,
      importanceStats,
      tagStats,
      tagWarnings,
      dailyActivity,
      timeDistribution,
      habits: habits.length,
      habitCompletion,
      avgEnergy,
      avgImportance,
      burnoutRisk,
      wellnessScore,
      productivityScore,
      breakEvents,
      personalEvents,
      deepWorkEvents
    }
  }, [events, selectedDate, tagWarningThreshold])

  const workTypeData = Object.entries(analytics.workTypeStats).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
    color: COLORS[type as keyof typeof COLORS]
  }))

  const energyData = Object.entries(analytics.energyStats).map(([level, count]) => ({
    name: `Level ${level}`,
    value: count,
    color: COLORS[`energy${level}` as keyof typeof COLORS]
  }))

  const tagData = Object.entries(analytics.tagStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({
      name: tag,
      value: count,
      color: count >= tagWarningThreshold ? '#ef4444' : '#3b82f6'
    }))

  return (
    <div className="space-y-6">
      {/* Header with Settings */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tag Warning Threshold</Label>
                <Input
                  type="number"
                  value={tagWarningThreshold}
                  onChange={(e) => onTagWarningThresholdChange?.(parseInt(e.target.value))}
                  min={1}
                  max={20}
                />
                <p className="text-xs text-muted-foreground">
                  Show warning when a tag is used this many times or more
                </p>
              </div>
              <div className="space-y-2">
                <Label>Time Range</Label>
                <Select value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setOpenExplanation('totalEvents')}><Info className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              This week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setOpenExplanation('completionRate')}><Info className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.completedEvents} of {analytics.totalEvents} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Wellness Score</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setOpenExplanation('wellnessScore')}><Info className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.wellnessScore.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Productivity</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setOpenExplanation('productivity')}><Info className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.productivityScore.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 100
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Explanation Dialogs */}
      <Dialog open={openExplanation !== null} onOpenChange={() => setOpenExplanation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openExplanation === 'totalEvents' && 'Total Events'}
              {openExplanation === 'completionRate' && 'Completion Rate'}
              {openExplanation === 'wellnessScore' && 'Wellness Score'}
              {openExplanation === 'productivity' && 'Productivity'}
            </DialogTitle>
          </DialogHeader>
          {openExplanation === 'totalEvents' && (
            <div>
              <p>This is the total number of events scheduled in the selected time range (e.g., week, month). It includes all types of events: study sessions, meetings, breaks, and personal time.</p>
            </div>
          )}
          {openExplanation === 'completionRate' && (
            <div>
              <p>The percentage of events that have all their checklist items marked as completed. It helps you track how many of your planned activities you actually finished.</p>
            </div>
          )}
          {openExplanation === 'wellnessScore' && (
            <div>
              <p>This score estimates your overall wellness based on the number of breaks, personal time, and habit completion. A higher score means you are balancing work and rest well.</p>
            </div>
          )}
          {openExplanation === 'productivity' && (
            <div>
              <p>This score estimates your productivity based on event completion, deep work sessions, and average energy level. A higher score means you are getting more important work done efficiently.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Burnout Risk</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge 
                variant={analytics.burnoutRisk === 'high' ? 'destructive' : 
                        analytics.burnoutRisk === 'medium' ? 'secondary' : 'default'}
              >
                {analytics.burnoutRisk.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {analytics.burnoutRisk === 'high' ? 'Take breaks!' : 
                 analytics.burnoutRisk === 'medium' ? 'Monitor closely' : 'Good balance'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Habits</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analytics.habits > 0 ? (
              <>
                <div className="text-2xl font-bold">{analytics.habits}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.habitCompletion.toFixed(1)}% completion
                </p>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">No habits tracked this week. Add a habit event to get started!</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Energy</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgEnergy.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 5
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tag Warnings */}
      {analytics.tagWarnings.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Tag Usage Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.tagWarnings.map(([tag, count]) => (
                <div key={tag} className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-red-600" />
                    <span className="font-medium">{tag}</span>
                  </div>
                  <Badge variant="destructive">{count} times</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="daily">Daily Activity</TabsTrigger>
          <TabsTrigger value="worktypes">Work Types</TabsTrigger>
          <TabsTrigger value="energy">Energy Levels</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Work-Life Balance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Deep Work</span>
                    <span className="font-medium">{analytics.deepWorkEvents}</span>
                  </div>
                  <Progress value={(analytics.deepWorkEvents / analytics.totalEvents) * 100} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Breaks</span>
                    <span className="font-medium">{analytics.breakEvents}</span>
                  </div>
                  <Progress value={(analytics.breakEvents / analytics.totalEvents) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Personal Time</span>
                    <span className="font-medium">{analytics.personalEvents}</span>
                  </div>
                  <Progress value={(analytics.personalEvents / analytics.totalEvents) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Productivity Score</span>
                    <span className="font-medium">{analytics.productivityScore.toFixed(0)}/100</span>
                  </div>
                  <Progress value={analytics.productivityScore} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Wellness Score</span>
                    <span className="font-medium">{analytics.wellnessScore.toFixed(0)}/100</span>
                  </div>
                  <Progress value={analytics.wellnessScore} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Habit Completion</span>
                    <span className="font-medium">{analytics.habitCompletion.toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics.habitCompletion} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="deepWork" stackId="a" fill={COLORS.deep} name="Deep Work" />
                  <Bar dataKey="shallowWork" stackId="a" fill={COLORS.shallow} name="Shallow Work" />
                  <Bar dataKey="breaks" stackId="a" fill={COLORS.break} name="Breaks" />
                  <Bar dataKey="personal" stackId="a" fill={COLORS.personal} name="Personal" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="worktypes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Work Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={workTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {workTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Work Type Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workTypeData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="energy" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Energy Level Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={energyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {energyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Energy Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Energy Level</span>
                    <span className="font-medium">{analytics.avgEnergy.toFixed(1)}/5</span>
                  </div>
                  <Progress value={(analytics.avgEnergy / 5) * 100} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>High Energy Events (4-5)</span>
                    <span className="font-medium">
                      {Object.entries(analytics.energyStats)
                        .filter(([level]) => parseInt(level) >= 4)
                        .reduce((sum, [, count]) => sum + count, 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Low Energy Events (1-2)</span>
                    <span className="font-medium">
                      {Object.entries(analytics.energyStats)
                        .filter(([level]) => parseInt(level) <= 2)
                        .reduce((sum, [, count]) => sum + count, 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Most Used Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tagData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {tagData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tag Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Unique Tags</span>
                    <span className="font-medium">{Object.keys(analytics.tagStats).length}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tags Above Threshold</span>
                    <span className="font-medium">{analytics.tagWarnings.length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Most Used Tag</span>
                    <span className="font-medium">
                      {tagData.length > 0 ? tagData[0].name : 'None'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.timeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="events" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Productivity Patterns</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Most active day: {analytics.dailyActivity.reduce((max, day) => 
                  day.events > max.events ? day : max).day}</li>
                <li>• Peak activity hour: {analytics.timeDistribution.reduce((max, hour) => 
                  hour.events > max.events ? hour : max).hour}</li>
                <li>• Work type balance: {workTypeData.length > 0 ? 
                  `${Math.round((workTypeData[0]?.value || 0) / analytics.totalEvents * 100)}% ${workTypeData[0]?.name}` : 'N/A'}</li>
                <li>• Deep work sessions: {analytics.deepWorkEvents}</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Recommendations</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {analytics.avgEnergy < 3 && (
                  <li>• Consider scheduling more high-energy tasks</li>
                )}
                {analytics.habitCompletion < 80 && (
                  <li>• Focus on improving habit consistency</li>
                )}
                {analytics.completionRate < 70 && (
                  <li>• Break down tasks into smaller, manageable pieces</li>
                )}
                {analytics.burnoutRisk === 'high' && (
                  <li>• Take more breaks and reduce high-energy tasks</li>
                )}
                {analytics.wellnessScore < 50 && (
                  <li>• Schedule more personal time and breaks</li>
                )}
                {analytics.tagWarnings.length > 0 && (
                  <li>• Consider reducing usage of frequently used tags</li>
                )}
                {analytics.avgEnergy >= 4 && analytics.burnoutRisk === 'low' && (
                  <li>• Great energy management! Keep up the momentum</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
