'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import ReactCrop, { Crop as ReactCropCrop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Tag, 
  Image, 
  CheckSquare, 
  Zap, 
  AlertTriangle,
  Bell,
  Upload,
  X,
  Plus,
  Star,
  Target,
  Heart,
  Brain,
  Coffee,
  Moon,
  Trash2,
  FileText,
  Paperclip,
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EnhancedCalendarEvent, ChecklistItem, Reminder } from '@/types/enhanced-calendar'
import { format, parseISO } from 'date-fns'
import { markEventAsDeadline, hasDeadlineTag } from '@/lib/calendar-bridge'

interface EnhancedEventEditorProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSave: (event: Partial<EnhancedCalendarEvent>) => void
  event?: EnhancedCalendarEvent
  defaultDate?: Date
  defaultTime?: string
  allTags: string[]
}

const ENERGY_COLORS = {
  1: 'bg-red-100 border-red-300 text-red-800',
  2: 'bg-orange-100 border-orange-300 text-orange-800', 
  3: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  4: 'bg-green-100 border-green-300 text-green-800',
  5: 'bg-emerald-100 border-emerald-300 text-emerald-800'
}

const IMPORTANCE_COLORS = {
  1: 'bg-gray-100 border-gray-300 text-gray-800',
  2: 'bg-blue-100 border-blue-300 text-blue-800',
  3: 'bg-purple-100 border-purple-300 text-purple-800',
  4: 'bg-orange-100 border-orange-300 text-orange-800',
  5: 'bg-red-100 border-red-300 text-red-800'
}

export function EnhancedEventEditor({
  isOpen,
  onOpenChange,
  onSave,
  event,
  defaultDate,
  defaultTime,
  allTags
}: EnhancedEventEditorProps) {
  const [formData, setFormData] = useState<Partial<EnhancedCalendarEvent>>({
    title: '',
    description: '',
    start: defaultDate || undefined,
    end: defaultDate || undefined,
    allDay: false,
    tags: [],
    energyLevel: 3,
    importance: 3,
    isHabit: false,
    checklist: [],
    reminders: [],
    pictures: [],
    workType: 'personal'
  })

  const [newTag, setNewTag] = useState('')
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [newReminderMinutes, setNewReminderMinutes] = useState(15)
  const [newReminderType, setNewReminderType] = useState<'notification' | 'email'>('notification')
  const [newReminderTiming, setNewReminderTiming] = useState<'before' | 'after'>('before')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'>('none')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [eventImage, setEventImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [crop, setCrop] = useState<ReactCropCrop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [showCropModal, setShowCropModal] = useState(false)
  const [energyLevel, setEnergyLevel] = useState<1|2|3|4|5>(3)
  const [studyDifficulty, setStudyDifficulty] = useState<1|2|3|4|5>(3)
  const [happiness, setHappiness] = useState<1|2|3|4|5>(3)

  const deadlineActive = hasDeadlineTag((formData.tags || []) as string[])

  const handleSetDeadline = async () => {
    try {
      if (!event?.id) return
      await markEventAsDeadline(event.id)
      const add = ['deadline','duedate','theme:black','fg:white','color:locked:black']
      const set = new Set([...(formData.tags || []), ...add])
      setFormData(prev => ({ ...prev, tags: Array.from(set) }))
    } catch (e) {
      console.warn('Failed to set deadline', e)
    }
  }

  // Activity templates
  const activityTemplates = [
    {
      id: 'study-session',
      name: 'Study Session',
      description: 'Focused study time with breaks',
      energyLevel: 4,
      importance: 4,
      workType: 'deep' as const,
      tags: ['study', 'focus'],
      checklist: [
        { id: '1', text: 'Review notes', completed: false, createdAt: new Date() },
        { id: '2', text: 'Practice problems', completed: false, createdAt: new Date() },
        { id: '3', text: 'Take breaks every 25 minutes', completed: false, createdAt: new Date() }
      ]
    },
    {
      id: 'team-meeting',
      name: 'Team Meeting',
      description: 'Collaborative team discussion',
      energyLevel: 3,
      importance: 4,
      workType: 'shallow' as const,
      tags: ['meeting', 'collaboration'],
      checklist: [
        { id: '1', text: 'Prepare agenda', completed: false, createdAt: new Date() },
        { id: '2', text: 'Share updates', completed: false, createdAt: new Date() },
        { id: '3', text: 'Assign action items', completed: false, createdAt: new Date() }
      ]
    },
    {
      id: 'break-time',
      name: 'Break Time',
      description: 'Rest and recharge',
      energyLevel: 1,
      importance: 2,
      workType: 'break' as const,
      tags: ['break', 'wellness'],
      checklist: [
        { id: '1', text: 'Step away from screen', completed: false, createdAt: new Date() },
        { id: '2', text: 'Stretch or walk', completed: false, createdAt: new Date() }
      ]
    },
    {
      id: 'personal-time',
      name: 'Personal Time',
      description: 'Personal activities and hobbies',
      energyLevel: 2,
      importance: 3,
      workType: 'personal' as const,
      tags: ['personal', 'hobby'],
      checklist: []
    }
  ]

  useEffect(() => {
    if (event) {
      setFormData({
        ...event,
        start: typeof event.start === 'string' ? parseISO(event.start) : event.start,
        end: typeof event.end === 'string' ? parseISO(event.end) : event.end,
      })
      if (typeof event.energyLevel === 'number') setEnergyLevel(event.energyLevel)
      if (typeof event.studyDifficulty === 'number') setStudyDifficulty(event.studyDifficulty)
      if (typeof event.moodAfter === 'number') setHappiness(event.moodAfter)
      // Set existing image preview if available
      if (event.pictures && event.pictures.length > 0) {
        setImagePreview(event.pictures[0])
      }
    } else {
      let start = defaultDate || null;
      let end = defaultDate || null;
      if (!start) start = new Date();
      if (!end) end = new Date(start);
      
      if (defaultTime) {
        const [hours, minutes] = defaultTime.split(':').map(Number)
        start.setHours(hours, minutes, 0, 0)
        end.setHours(hours + 1, minutes, 0, 0)
      } else {
        end.setHours(end.getHours() + 1)
      }

      setFormData(prev => ({
        ...prev,
        start: start || undefined,
        end: end || undefined
      }))
      setImagePreview(null)
    }
  }, [event, defaultDate, defaultTime])

  const convertImageToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const centerAspectCrop = (
    mediaWidth: number,
    mediaHeight: number,
    aspect: number,
  ) => {
    return centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect,
        mediaWidth,
        mediaHeight,
      ),
      mediaWidth,
      mediaHeight,
    )
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (aspect) {
      const { width, height } = e.currentTarget
      setCrop(centerAspectCrop(width, height, aspect))
    }
  }

  const getCroppedImg = (
    image: HTMLImageElement,
    crop: PixelCrop,
    fileName: string,
  ): Promise<Blob> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('No 2d context')
    }

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = crop.width
    canvas.height = crop.height

    ctx.imageSmoothingQuality = 'high'

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height,
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        1,
      )
    })
  }

  const aspect = 16 / 9 // Standard aspect ratio for event images

  const handleSave = async () => {
    let pictures: string[] | undefined;
    
    if (eventImage && completedCrop) {
      try {
        // Get the image element and crop it
        const imageElement = document.querySelector('#crop-image') as HTMLImageElement;
        if (imageElement) {
          const croppedBlob = await getCroppedImg(imageElement, completedCrop, eventImage.name);
          const base64Image = await convertImageToBase64(croppedBlob);
          pictures = [base64Image];
        }
      } catch (error) {
        console.error('Error processing cropped image:', error);
        // Fallback to original image if cropping fails
        try {
          const base64Image = await convertImageToBase64(eventImage);
          pictures = [base64Image];
        } catch (fallbackError) {
          console.error('Error converting original image to base64:', fallbackError);
          pictures = undefined;
        }
      }
    } else if (eventImage) {
      // No crop applied, use original image
      try {
        const base64Image = await convertImageToBase64(eventImage);
        pictures = [base64Image];
      } catch (error) {
        console.error('Error converting image to base64:', error);
        pictures = undefined;
      }
    } else if (event?.pictures && event.pictures.length > 0) {
      // Keep existing images if no new image is uploaded
      pictures = event.pictures;
    }

    // Normalize and dedupe tags (do NOT auto-add any tags like 'study')
    const originalTags: string[] = Array.isArray(formData.tags) ? (formData.tags as string[]) : []
    const seen = new Set<string>()
    const dedupedTags = [] as string[]
    for (const t of originalTags) {
      const key = String(t).trim().toLowerCase()
      if (!key) continue
      if (!seen.has(key)) { seen.add(key); dedupedTags.push(t) }
    }

    // Ensure all form data is properly included
    const eventData = {
      ...formData,
      id: event?.id || `event-${Date.now()}`,
      start: formData.start || new Date(),
      end: formData.end || new Date(),
      title: formData.title || '',
      description: formData.description || '',
      location: formData.location || '',
      tags: dedupedTags,
      checklist: formData.checklist || [],
      reminders: formData.reminders || [],
      workType: formData.workType || 'personal',
      importance: formData.importance || 3,
      isHabit: formData.isHabit || false,
      habitStreak: formData.habitStreak || 0,
      productivity: formData.productivity || 3,
      notes: formData.notes || '',
      completed: formData.completed || false,
      color: formData.color || 'blue',
      recurrence: recurrenceType !== 'none' ? {
        type: recurrenceType,
        endDate: recurrenceEndDate ?? undefined,
        interval: 1
      } : undefined,
      energyLevel: energyLevel,
      studyDifficulty: studyDifficulty,
      moodAfter: happiness,
      pictures: pictures,
      files: formData.files || [],
    }
    
    console.log('Saving event data:', eventData); // Debug log
    console.log('Selected event before save:', event); // Debug log
    onSave(eventData)
    onOpenChange(false)
  }

  const addTag = () => {
    if (newTag && !formData.tags?.includes(newTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove)
    }))
  }

  const addChecklistItem = () => {
    if (newChecklistItem) {
      const item: ChecklistItem = {
        id: `checklist-${Date.now()}`,
        text: newChecklistItem,
        completed: false,
        createdAt: new Date()
      }
      setFormData(prev => ({
        ...prev,
        checklist: [...(prev.checklist || []), item]
      }))
      setNewChecklistItem('')
    }
  }

  const toggleChecklistItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist?.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    }))
  }

  const removeChecklistItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist?.filter(item => item.id !== itemId)
    }))
  }

  const moveChecklistItem = (itemId: string, direction: 'up' | 'down') => {
    setFormData(prev => {
      const list = prev.checklist || [];
      const idx = list.findIndex(item => item.id === itemId);
      if (idx === -1) return prev;
      const newList = [...list];
      if (direction === 'up' && idx > 0) {
        [newList[idx - 1], newList[idx]] = [newList[idx], newList[idx - 1]];
      } else if (direction === 'down' && idx < newList.length - 1) {
        [newList[idx + 1], newList[idx]] = [newList[idx], newList[idx + 1]];
      }
      return { ...prev, checklist: newList };
    });
  }

  const addReminder = () => {
    const reminder: Reminder = {
      id: `reminder-${Date.now()}`,
      type: newReminderType,
      minutes: newReminderMinutes,
      timing: newReminderTiming,
      isActive: true
    }
    setFormData(prev => ({
      ...prev,
      reminders: [...(prev.reminders || []), reminder]
    }))
  }

  const removeReminder = (reminderId: string) => {
    setFormData(prev => ({
      ...prev,
      reminders: prev.reminders?.filter(r => r.id !== reminderId)
    }))
  }

  const getReminderText = (minutes: number, timing: 'before' | 'after' = 'before') => {
    const timingText = timing === 'before' ? 'before' : 'after'
    if (minutes < 60) return `${minutes} minutes ${timingText}`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ${timingText}`
    return `${Math.floor(minutes / 1440)} days ${timingText}`
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setNewFile(file)
    }
  }

  const addFile = async () => {
    if (newFile) {
      try {
        const base64File = await convertImageToBase64(newFile);
        const fileAttachment = {
          id: `file-${Date.now()}`,
          name: newFile.name,
          size: newFile.size,
          type: newFile.type,
          url: base64File
        }
        setFormData(prev => ({
          ...prev,
          files: [...(prev.files || []), fileAttachment]
        }))
        setNewFile(null)
      } catch (error) {
        console.error('Error converting file to base64:', error);
      }
    }
  }

  const removeFile = (fileId: string) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files?.filter(file => file.id !== fileId)
    }))
  }

  const applyTemplate = (templateId: string) => {
    const template = activityTemplates.find(t => t.id === templateId)
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.name,
        description: template.description,
        energyLevel: template.energyLevel as 1|2|3|4|5,
        importance: template.importance as 1|2|3|4|5,
        workType: template.workType,
        tags: Array.from(new Set([...(prev.tags || []), ...template.tags])),
        checklist: template.checklist
      }))
      setSelectedTemplate(templateId)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="basic" className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Event title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Optional location"
                  />
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.start && !isNaN(new Date(formData.start).getTime()) ? format(formData.start as Date, 'MMM d, yyyy') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.start}
                          onSelect={(date) => date && setFormData(prev => ({ ...prev, start: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={formData.start && !isNaN(new Date(formData.start).getTime()) ? format(formData.start as Date, 'HH:mm') : ''}
                      onChange={(e) => {
                        const val = e.target.value
                        let hours = 0, minutes = 0
                        if (val && /^\d{1,2}:\d{2}$/.test(val)) {
                          const parts = val.split(':')
                          hours = Math.max(0, Math.min(23, Number(parts[0]) || 0))
                          minutes = Math.max(0, Math.min(59, Number(parts[1]) || 0))
                        }
                        const base = new Date(formData.start || new Date())
                        base.setHours(hours, minutes, 0, 0)
                        setFormData(prev => ({ ...prev, start: base }))
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.end && !isNaN(new Date(formData.end).getTime()) ? format(formData.end as Date, 'MMM d, yyyy') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.end}
                          onSelect={(date) => date && setFormData(prev => ({ ...prev, end: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={formData.end && !isNaN(new Date(formData.end).getTime()) ? format(formData.end as Date, 'HH:mm') : ''}
                      onChange={(e) => {
                        const val = e.target.value
                        let hours = 0, minutes = 0
                        if (val && /^\d{1,2}:\d{2}$/.test(val)) {
                          const parts = val.split(':')
                          hours = Math.max(0, Math.min(23, Number(parts[0]) || 0))
                          minutes = Math.max(0, Math.min(59, Number(parts[1]) || 0))
                        }
                        const base = new Date(formData.end || new Date())
                        base.setHours(hours, minutes, 0, 0)
                        setFormData(prev => ({ ...prev, end: base }))
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="allDay"
                  checked={formData.allDay}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allDay: checked }))}
                />
                <Label htmlFor="allDay">All Day Event</Label>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description"
                  rows={3}
                />
              </div>

              {/* Recurrence Settings */}
              <div className="space-y-2">
                <Label>Recurrence</Label>
                <Select 
                  value={recurrenceType} 
                  onValueChange={(value) => setRecurrenceType(value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Recurrence</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                
                {recurrenceType !== 'none' && (
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {recurrenceEndDate ? format(recurrenceEndDate, 'MMM d, yyyy') : 'No end date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={recurrenceEndDate}
                          onSelect={(date) => setRecurrenceEndDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Activity Templates */}
              <div className="space-y-2">
                <Label>Activity Template</Label>
                <div className="flex gap-2">
                  <Select 
                    value={selectedTemplate} 
                    onValueChange={(value) => applyTemplate(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {activityTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsTemplateDialogOpen(true)}
                  >
                    Edit Templates
                  </Button>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag"
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button onClick={addTag} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {formData.tags?.map((tag, index) => (
                    <Badge key={`current-tag-${index}-${tag}`} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
                {allTags.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Suggested tags:</Label>
                    <div className="flex flex-wrap gap-1">
                      {allTags.filter(tag => !formData.tags?.includes(tag)).slice(0, 10).map((tag, index) => (
                        <Badge 
                          key={`suggested-tag-${index}-${tag}`} 
                          variant="outline" 
                          className="cursor-pointer"
                          onClick={() => setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }))}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              {/* Study Difficulty */}
              <div className="space-y-2">
                <Label>How hard was the study session (if applicable) 1-5</Label>
                <div className="flex items-center gap-2">
                  {([1, 2, 3, 4, 5] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={studyDifficulty === level}
                      onClick={() => setStudyDifficulty(level)}
                      className={cn(
                        "w-8 h-8 rounded-md border-2 transition-all duration-200 hover-gentle flex items-center justify-center text-xs font-medium",
                        studyDifficulty === level ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/30",
                        "hover:bg-muted"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a difficulty from 1 (easiest) to 5 (hardest).
                </p>
              </div>

              {/* Energy Level */}
              <div className="space-y-2">
                <Label>Energy Level (1-5)</Label>
                <div className="flex items-center gap-2">
                  {([1, 2, 3, 4, 5] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={energyLevel === level}
                      onClick={() => setEnergyLevel(level)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all duration-200 hover-gentle",
                        energyLevel === level ? "border-primary scale-110" : "border-muted-foreground/30",
                        level === 1 && "bg-red-100 hover:bg-red-200",
                        level === 2 && "bg-orange-100 hover:bg-orange-200",
                        level === 3 && "bg-yellow-100 hover:bg-yellow-200",
                        level === 4 && "bg-green-100 hover:bg-green-200",
                        level === 5 && "bg-blue-100 hover:bg-blue-200"
                      )}
                    >
                      <span className="text-xs font-medium">{level}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Happiness */}
              <div className="space-y-2">
                <Label>Happiness (1-5)</Label>
                <div className="flex items-center gap-2">
                  {([1,2,3,4,5] as const).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setHappiness(val)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all duration-200 hover-gentle",
                        happiness === val ? "border-primary scale-110" : "border-muted-foreground/30",
                        val === 1 && "bg-red-100 hover:bg-red-200",
                        val === 2 && "bg-orange-100 hover:bg-orange-200",
                        val === 3 && "bg-yellow-100 hover:bg-yellow-200",
                        val === 4 && "bg-green-100 hover:bg-green-200",
                        val === 5 && "bg-blue-100 hover:bg-blue-200"
                      )}
                    >
                      <span className="text-xs font-medium">{val}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Your overall happiness after this activity.</p>
              </div>

              {/* Deadline Control - one-way set to black/white */}
              <div className="flex items-center gap-8 mt-2 mb-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Deadline</div>
                  <div className="text-xs text-muted-foreground">Forces black background and white text. Overrides energy color.</div>
                </div>
                <Button onClick={handleSetDeadline} variant={deadlineActive ? 'default' : 'outline'}>Deadline</Button>
              </div>

              {/* Event Image Upload */}
              <div className="space-y-2">
                <Label>Event Image (Optional)</Label>
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center hover-gentle">
                  {eventImage ? (
                    <div className="space-y-2">
                      <img
                        src={imagePreview || URL.createObjectURL(eventImage)}
                        alt="Event preview"
                        className="w-full h-32 object-cover rounded-md mx-auto"
                      />
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-sm text-muted-foreground">{eventImage.name}</span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCropModal(true)}
                            className="text-blue-600"
                          >
                            <Crop className="h-3 w-3 mr-1" />
                            Crop
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEventImage(null)
                              setImagePreview(null)
                              setCrop(undefined)
                              setCompletedCrop(undefined)
                            }}
                            className="text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload an image for this event
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setEventImage(file)
                            try {
                              const base64 = await convertImageToBase64(file)
                              setImagePreview(base64)
                            } catch (error) {
                              console.error('Error creating image preview:', error)
                            }
                          }
                        }}
                        className="hidden"
                        id="event-image"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => document.getElementById("event-image")?.click()}
                      >
                        Choose Image
                      </Button>                    </div>
                  )}
                </div>
              </div>

              {/* Importance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Importance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Slider
                      value={[formData.importance || 3]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, importance: value as 1|2|3|4|5 }))}
                      max={5}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm">
                      <span>1 - Low</span>
                      <span>3 - Medium</span>
                      <span>5 - Critical</span>
                    </div>
                    <div className={cn("p-2 rounded border text-center", IMPORTANCE_COLORS[formData.importance || 3])}>
                      Importance: {formData.importance}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Work Type */}
              <div className="space-y-2">
                <Label>Work Type</Label>
                <Select 
                  value={formData.workType} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, workType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deep">🧠 Deep Work</SelectItem>
                    <SelectItem value="shallow">📝 Shallow Work</SelectItem>
                    <SelectItem value="break">☕ Break</SelectItem>
                    <SelectItem value="personal">❤️ Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Habit Tracking */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="isHabit"
                  checked={formData.isHabit}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isHabit: checked }))}
                />
                <Label htmlFor="isHabit" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Track as Habit
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    Event Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new checklist item */}
                  <div className="flex gap-2">
                    <Input
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder="Add checklist item"
                      onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                    />
                    <Button onClick={addChecklistItem} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Checklist items */}
                  <div className="space-y-2">
                    {formData.checklist?.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleChecklistItem(item.id)}
                        />
                        <span className={cn("flex-1", item.completed && "line-through text-muted-foreground")}>
                          {item.text}
                        </span>
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" onClick={() => moveChecklistItem(item.id, 'up')} disabled={idx === 0}>
                            ↑
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => moveChecklistItem(item.id, 'down')} disabled={idx === formData.checklist!.length - 1}>
                            ↓
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChecklistItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {formData.checklist?.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">
                      No checklist items yet. Add some tasks above!
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reminders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Reminders
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new reminder */}
                  <div className="grid grid-cols-4 gap-2">
                    <Select 
                      value={newReminderType} 
                      onValueChange={(value) => setNewReminderType(value as 'notification' | 'email')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notification">📱 App Notification</SelectItem>
                        <SelectItem value="email">📧 Email</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select 
                      value={newReminderTiming} 
                      onValueChange={(value) => setNewReminderTiming(value as 'before' | 'after')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Before</SelectItem>
                        <SelectItem value="after">After</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select 
                      value={newReminderMinutes.toString()} 
                      onValueChange={(value) => setNewReminderMinutes(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="1440">1 day</SelectItem>
                        <SelectItem value="10080">1 week</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addReminder} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Existing reminders */}
                  <div className="space-y-2">
                    {formData.reminders?.map((reminder) => (
                      <div key={reminder.id} className="flex items-center gap-2 p-2 border rounded">
                        <div className="flex-1">
                          <span className="font-medium">
                            {reminder.type === 'email' ? '📧' : '📱'} {getReminderText(reminder.minutes, reminder.timing)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeReminder(reminder.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {formData.reminders?.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">
                      No reminders set. Add some above!
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    File Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* File upload */}
                  <div className="space-y-2">
                    <Label>Upload File</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        onChange={handleFileUpload}
                        accept="*/*"
                        className="flex-1"
                      />
                      <Button onClick={addFile} size="sm" disabled={!newFile}>
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    {newFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {newFile.name} ({(newFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  {/* File list */}
                  <div className="space-y-2">
                    {formData.files?.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 p-2 border rounded">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {formData.files?.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">
                      No files attached. Upload files above!
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {event ? 'Update Event' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Image Cropping Modal */}
      <Dialog open={showCropModal} onOpenChange={setShowCropModal}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Crop & Edit Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {eventImage && (
              <div className="space-y-4">
                {/* Image Controls */}
                <div className="flex items-center gap-4 justify-center">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Zoom:</Label>
                    <Slider
                      value={[scale]}
                      onValueChange={([value]) => setScale(value)}
                      min={0.5}
                      max={3}
                      step={0.1}
                      className="w-24"
                    />
                    <span className="text-sm w-12">{Math.round(scale * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Rotation:</Label>
                    <Slider
                      value={[rotation]}
                      onValueChange={([value]) => setRotation(value)}
                      min={-180}
                      max={180}
                      step={15}
                      className="w-24"
                    />
                    <span className="text-sm w-12">{rotation}°</span>
                  </div>
                </div>

                {/* Cropping Area */}
                <div className="flex justify-center">
                  <div className="relative">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={aspect}
                      minWidth={100}
                      minHeight={100}
                      keepSelection
                    >
                      <img
                        id="crop-image"
                        src={URL.createObjectURL(eventImage)}
                        alt="Crop preview"
                        onLoad={onImageLoad}
                        style={{
                          transform: `scale(${scale}) rotate(${rotation}deg)`,
                          maxWidth: '100%',
                          maxHeight: '400px',
                          cursor: 'move'
                        }}
                        draggable={false}
                      />
                    </ReactCrop>
                  </div>
                </div>

                {/* Cropped Image Preview */}
                {completedCrop && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium mb-2">Cropped Preview (Standardized Size)</Label>
                    <div className="flex justify-center">
                      <div className="w-32 h-18 border rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                        <img
                          src={imagePreview || URL.createObjectURL(eventImage)}
                          alt="Cropped preview"
                          className="w-full h-full object-cover"
                          style={{
                            transform: `scale(${scale}) rotate(${rotation}deg)`,
                            transformOrigin: 'center'
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      This is how your image will appear in the activity
                    </p>
                  </div>
                )}

                <div className="text-center text-sm text-muted-foreground">
                  Drag to crop • Use zoom and rotation controls above • Standard 16:9 aspect ratio
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCropModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCropModal(false)}>
              Apply Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Activity Templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose from predefined activity templates to quickly set up common event types.
            </p>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {activityTemplates.map(template => (
                <Card key={template.id} className="cursor-pointer hover:bg-muted/50" onClick={() => applyTemplate(template.id)}>
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        Energy: {template.energyLevel}/5
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        Importance: {template.importance}/5
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag className="h-4 w-4" />
                        {template.tags.join(', ')}
                      </div>
                    </div>
                    {template.checklist.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Checklist:</p>
                        <ul className="text-xs space-y-1">
                          {template.checklist.map(item => (
                            <li key={item.id} className="flex items-center gap-2">
                              <CheckSquare className="h-3 w-3" />
                              {item.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            </ScrollArea>          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
