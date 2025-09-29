'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Plus, 
  Trash2, 
  Edit, 
  Calendar as CalendarIcon, 
  Clock, 
  Star, 
  Tag, 
  Zap,
  Sparkles,
  Target,
  Filter,
  Copy,
  Settings,
  Brain,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface ChoreTemplate {
  id: string
  name: string
  description?: string
  estimatedDuration: number // in minutes
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  customDays?: number // for custom frequency
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

interface ChoreTemplatesProps {
  templates: ChoreTemplate[]
  onTemplatesChange: (templates: ChoreTemplate[]) => void
  schedules: ChoreSchedule[]
  onSchedulesChange: (schedules: ChoreSchedule[]) => void
  categories: string[]
  allTags: string[]
  onCreateEventFromTemplate?: (template: ChoreTemplate) => void
}

const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  custom: 'Custom'
}

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800 border-gray-300',
  medium: 'bg-blue-100 text-blue-800 border-blue-300',
  high: 'bg-red-100 text-red-800 border-red-300'
}

const ENERGY_COLORS = {
  1: 'bg-red-100 border-red-300 text-red-800',
  2: 'bg-orange-100 border-orange-300 text-orange-800',
  3: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  4: 'bg-green-100 border-green-300 text-green-800',
  5: 'bg-emerald-100 border-emerald-300 text-emerald-800'
}

export function ChoreTemplates({ 
  templates, 
  onTemplatesChange, 
  schedules, 
  onSchedulesChange,
  categories, 
  allTags,
  onCreateEventFromTemplate
}: ChoreTemplatesProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ChoreTemplate | null>(null)
  const [activeTab, setActiveTab] = useState<'templates' | 'ai'>('templates')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([])

  const [newTemplate, setNewTemplate] = useState<Partial<ChoreTemplate>>({
    name: '',
    description: '',
    estimatedDuration: 30,
    frequency: 'weekly',
    priority: 'medium',
    category: categories[0] || 'General',
    energyLevel: 3,
    tags: [],
    isActive: true,
    nextDue: new Date()
  })

  const filteredTemplates = templates.filter(template => {
    if (filter === 'active') return template.isActive
    if (filter === 'inactive') return !template.isActive
    return true
  }).filter(template => {
    if (categoryFilter === 'all') return true
    return template.category === categoryFilter
  })

  const addTemplate = () => {
    if (!newTemplate.name?.trim()) return
    if (!newTemplate.nextDue) {
      toast({
        title: "Due Date Required",
        description: "Please set a due date for this chore template.",
        variant: "destructive"
      })
      return
    }
    const now = new Date();
    const template: ChoreTemplate = {
      id: `template-${Date.now()}`,
      name: newTemplate.name,
      description: newTemplate.description,
      estimatedDuration: newTemplate.estimatedDuration || 30,
      frequency: newTemplate.frequency || 'weekly',
      customDays: newTemplate.customDays,
      priority: newTemplate.priority || 'medium',
      category: newTemplate.category || 'General',
      energyLevel: newTemplate.energyLevel || 3,
      tags: newTemplate.tags || [],
      instructions: newTemplate.instructions,
      isActive: newTemplate.isActive ?? true,
      nextDue: newTemplate.nextDue,
      createdAt: now,
      updatedAt: now
    }

    onTemplatesChange([...templates, template])
    setNewTemplate({
      name: '',
      description: '',
      estimatedDuration: 30,
      frequency: 'weekly',
      priority: 'medium',
      category: categories[0] || 'General',
      energyLevel: 3,
      tags: [],
      isActive: true,
      nextDue: new Date()
    })
    setIsAddDialogOpen(false)
  }

  const updateTemplate = (id: string, updates: Partial<ChoreTemplate>) => {
    const updatedTemplates = templates.map(template =>
      template.id === id ? { ...template, ...updates, updatedAt: new Date() } : template
    )
    onTemplatesChange(updatedTemplates)
  }

  const deleteTemplate = (id: string) => {
    // Prevent deletion if template is in use by a schedule
    if (schedules.some(schedule => schedule.templateId === id)) {
      toast({
        title: "Cannot Delete Template",
        description: "This template is in use by a scheduled chore. Remove all schedules before deleting.",
        variant: "destructive"
      });
      return;
    }
    onTemplatesChange(templates.filter(template => template.id !== id))
    // Also remove related schedules
    onSchedulesChange(schedules.filter(schedule => schedule.templateId !== id))
  }

  const duplicateTemplate = (template: ChoreTemplate) => {
    const duplicated: ChoreTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    onTemplatesChange([...templates, duplicated])
  }

  const addTag = (tag: string) => {
    if (!newTemplate.tags?.includes(tag)) {
      setNewTemplate(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }))
    }
  }

  const removeTag = (tagToRemove: string) => {
    setNewTemplate(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove)
    }))
  }

  const generateAiRecommendations = () => {
    // Simulate AI recommendations based on existing templates and schedules
    const recommendations = [
      {
        id: 'rec-1',
        type: 'schedule_optimization',
        title: 'Optimize Weekly Schedule',
        description: 'Based on your energy patterns, schedule high-energy chores in the morning',
        action: 'Apply Optimization',
        impact: 'high'
      },
      {
        id: 'rec-2',
        type: 'frequency_adjustment',
        title: 'Adjust Cleaning Frequency',
        description: 'Consider reducing bathroom cleaning to bi-weekly based on usage patterns',
        action: 'Update Frequency',
        impact: 'medium'
      },
      {
        id: 'rec-3',
        type: 'new_template',
        title: 'Add Meal Prep Template',
        description: 'Create a weekly meal prep routine to save time during busy weekdays',
        action: 'Create Template',
        impact: 'high'
      }
    ]
    setAiRecommendations(recommendations)
  }

  const applyAiRecommendation = (recommendation: any) => {
    switch (recommendation.type) {
      case 'new_template':
        setNewTemplate({
          name: 'Weekly Meal Prep',
          description: 'Prepare meals for the week ahead',
          estimatedDuration: 120,
          frequency: 'weekly',
          priority: 'high',
          category: 'Kitchen',
          energyLevel: 4,
          tags: ['meal-prep', 'cooking'],
          isActive: true,
          nextDue: new Date()
        })
        setIsAddDialogOpen(true)
        break
      case 'schedule_optimization':
        // Apply schedule optimization logic
        toast({
          title: "Schedule Optimized",
          description: "Your chore schedule has been optimized for better energy management.",
        })
        break
      case 'frequency_adjustment':
        // Find and update template frequency
        const templateToUpdate = templates.find(t => t.name.toLowerCase().includes('bathroom'))
        if (templateToUpdate) {
          updateTemplate(templateToUpdate.id, { frequency: 'biweekly' })
        }
        break
    }
  }

  const getNextDueDate = (template: ChoreTemplate) => {
    if (!template.lastCompleted) return template.nextDue || new Date()
    
    const lastCompleted = new Date(template.lastCompleted)
    const nextDue = new Date(lastCompleted)
    
    switch (template.frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + 1)
        break
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + 7)
        break
      case 'biweekly':
        nextDue.setDate(nextDue.getDate() + 14)
        break
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + 1)
        break
      case 'custom':
        nextDue.setDate(nextDue.getDate() + (template.customDays || 7))
        break
    }
    
    return nextDue
  }

  const markAsCompleted = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return

    const completedDate = new Date()
    const nextDue = getNextDueDate(template)
    
    updateTemplate(templateId, {
      lastCompleted: completedDate,
      nextDue: nextDue
    })

    // Add to schedules
    const schedule: ChoreSchedule = {
      id: `schedule-${Date.now()}`,
      templateId,
      scheduledDate: completedDate,
      completed: true,
      actualDuration: template.estimatedDuration
    }
    onSchedulesChange([...schedules, schedule])
  }

  const stats = {
    total: templates.length,
    active: templates.filter(t => t.isActive).length,
    completed: schedules.filter(s => s.completed).length,
    overdue: templates.filter(t => {
      if (!t.isActive || !t.nextDue) return false
      return new Date() > t.nextDue
    }).length
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="ai">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={() => setIsAddDialogOpen(true)} className="ml-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Templates List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(template => {
              const nextDue = template.nextDue || getNextDueDate(template)
              const isOverdue = new Date() > nextDue
              
              return (
                <Card key={template.id} className={cn(
                  "transition-all duration-200 h-full flex flex-col",
                  !template.isActive && "opacity-60 bg-muted/50"
                )}>
                  <CardHeader className="pb-3 flex-shrink-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTemplate(template)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateTemplate(template)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", PRIORITY_COLORS[template.priority])}
                      >
                        {template.priority}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", ENERGY_COLORS[template.energyLevel])}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        {template.energyLevel}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {FREQUENCY_LABELS[template.frequency]}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{template.estimatedDuration} min</span>
                    </div>

                    {template.category && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Tag className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{template.category}</span>
                      </div>
                    )}

                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 mt-auto">
                      <div className="text-sm min-w-0 flex-1">
                        <span className={cn(
                          "block truncate",
                          isOverdue ? "text-red-600" : "text-muted-foreground"
                        )}>
                          {isOverdue ? 'Overdue' : 'Due'} {nextDue.toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => markAsCompleted(template.id)}
                          disabled={!template.isActive}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Done
                        </Button>
                        {onCreateEventFromTemplate && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCreateEventFromTemplate(template)}
                          >
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            Create Event
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No chore templates found</p>
                <Button onClick={() => setIsAddDialogOpen(true)} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first template
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Powered Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={generateAiRecommendations} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Recommendations
              </Button>

              {aiRecommendations.length > 0 && (
                <div className="space-y-3">
                  {aiRecommendations.map(recommendation => (
                    <Card key={recommendation.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-blue-500" />
                              {recommendation.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {recommendation.description}
                            </p>
                            <Badge 
                              variant={recommendation.impact === 'high' ? 'default' : 'secondary'}
                              className="mt-2"
                            >
                              {recommendation.impact} impact
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => applyAiRecommendation(recommendation)}
                          >
                            {recommendation.action}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Template Dialog */}
      <Dialog open={isAddDialogOpen || !!editingTemplate} onOpenChange={() => {
        setIsAddDialogOpen(false)
        setEditingTemplate(null)
        setNewTemplate({
          name: '',
          description: '',
          estimatedDuration: 30,
          frequency: 'weekly',
          priority: 'medium',
          category: categories[0] || 'General',
          energyLevel: 3,
          tags: [],
          isActive: true,
          nextDue: new Date()
        })
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Chore Template' : 'Add New Chore Template'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={editingTemplate?.name || newTemplate.name}
                  onChange={(e) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, name: e.target.value })
                    } else {
                      setNewTemplate({ ...newTemplate, name: e.target.value })
                    }
                  }}
                  placeholder="Chore name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={editingTemplate?.category || newTemplate.category} 
                  onValueChange={(value) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, category: value })
                    } else {
                      setNewTemplate({ ...newTemplate, category: value })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editingTemplate?.description || newTemplate.description}
                onChange={(e) => {
                  if (editingTemplate) {
                    setEditingTemplate({ ...editingTemplate, description: e.target.value })
                  } else {
                    setNewTemplate({ ...newTemplate, description: e.target.value })
                  }
                }}
                placeholder="Describe the chore..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select 
                  value={editingTemplate?.frequency || newTemplate.frequency} 
                  onValueChange={(value) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, frequency: value as any })
                    } else {
                      setNewTemplate({ ...newTemplate, frequency: value as any })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={editingTemplate?.priority || newTemplate.priority} 
                  onValueChange={(value) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, priority: value as any })
                    } else {
                      setNewTemplate({ ...newTemplate, priority: value as any })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Energy Level</Label>
                <Select 
                  value={(editingTemplate?.energyLevel || newTemplate.energyLevel)?.toString()} 
                  onValueChange={(value) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, energyLevel: parseInt(value) as any })
                    } else {
                      setNewTemplate({ ...newTemplate, energyLevel: parseInt(value) as any })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Low</SelectItem>
                    <SelectItem value="2">2 - Medium-Low</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - Medium-High</SelectItem>
                    <SelectItem value="5">5 - High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Duration (minutes)</Label>
                <Input
                  type="number"
                  value={editingTemplate?.estimatedDuration || newTemplate.estimatedDuration}
                  onChange={(e) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, estimatedDuration: parseInt(e.target.value) })
                    } else {
                      setNewTemplate({ ...newTemplate, estimatedDuration: parseInt(e.target.value) })
                    }
                  }}
                  min={1}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal w-full">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {(editingTemplate?.nextDue || newTemplate.nextDue) ? 
                        format(editingTemplate?.nextDue || newTemplate.nextDue!, 'PPP') : 
                        'Pick a date'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[50] mt-2">
                    <CalendarPicker
                      mode="single"
                      selected={editingTemplate?.nextDue || newTemplate.nextDue}
                      onSelect={(date) => {
                        if (editingTemplate) {
                          setEditingTemplate({ ...editingTemplate, nextDue: date })
                        } else {
                          setNewTemplate({ ...newTemplate, nextDue: date })
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(editingTemplate?.tags || newTemplate.tags || []).map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => removeTag(tag)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') removeTag(tag) }}
                      className="ml-1 hover:text-red-600 cursor-pointer"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </span>
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {allTags.filter(tag => !(editingTemplate?.tags || newTemplate.tags || []).includes(tag)).slice(0, 10).map(tag => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => addTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                value={editingTemplate?.instructions || newTemplate.instructions}
                onChange={(e) => {
                  if (editingTemplate) {
                    setEditingTemplate({ ...editingTemplate, instructions: e.target.value })
                  } else {
                    setNewTemplate({ ...newTemplate, instructions: e.target.value })
                  }
                }}
                placeholder="Step-by-step instructions..."
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={editingTemplate?.isActive ?? newTemplate.isActive}
                onCheckedChange={(checked) => {
                  if (editingTemplate) {
                    setEditingTemplate({ ...editingTemplate, isActive: checked })
                  } else {
                    setNewTemplate({ ...newTemplate, isActive: checked })
                  }
                }}
              />
              <Label htmlFor="isActive">Active Template</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false)
              setEditingTemplate(null)
            }}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (editingTemplate) {
                updateTemplate(editingTemplate.id, editingTemplate)
                setEditingTemplate(null)
              } else {
                addTemplate()
              }
            }}>
              {editingTemplate ? 'Update Template' : 'Add Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
