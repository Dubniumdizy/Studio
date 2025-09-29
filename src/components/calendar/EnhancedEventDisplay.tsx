'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { isValidDateValue, sanitizeEventPatch } from '@/utils/event-validation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Edit, 
  Trash2, 
  Copy, 
  Clock, 
  MapPin, 
  Tag, 
  CheckCircle, 
  Circle, 
  Star,
  Zap,
  Users,
  FileText,
  Bell,
  Image as ImageIcon,
  Calendar,
  Target,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { type EnhancedCalendarEvent } from '@/types/enhanced-calendar'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogFooter } from '@/components/ui/dialog'

interface EnhancedEventDisplayProps {
  event: EnhancedCalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onEdit: (event: EnhancedCalendarEvent) => void
  onDelete: (eventId: string) => void
  onDuplicate?: (event: EnhancedCalendarEvent) => void
  onUpdate?: (event: Partial<EnhancedCalendarEvent>) => void}

export function EnhancedEventDisplay({ 
  event, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete, 
  onDuplicate = () => {},
  onUpdate = () => {},
}: EnhancedEventDisplayProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  if (!event) return null

const toggleChecklistItem = (itemId: string) => {
    if (!event?.checklist) return
    
    const updatedEvent = {
      ...event,
      checklist: event.checklist.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    }
    
    // Validate the update
    const sanitizedEvent = sanitizeEventPatch(updatedEvent)
    if (!isValidDateValue(sanitizedEvent.start) || !isValidDateValue(sanitizedEvent.end)) {
      toast.error('Invalid event times. Changes not saved.')
      return
    }
    
    onUpdate(sanitizedEvent)
  }
const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const actualEvent = event.originalEvent || event
      
      // If this is a recurring event and we're deleting a future instance
      if (actualEvent.recurrence?.type !== 'none' && event.originalEvent) {
        const selectedDate = new Date(event.start)
        const originalStart = new Date(actualEvent.start)
        
        // If selected instance is at or before original start, delete entire series
        if (selectedDate <= originalStart) {
          await onDelete(actualEvent.id)
          toast.success('Recurring event series deleted')
        } else {
          // Otherwise, update recurrence end date to preserve earlier instances
          const dayBefore = new Date(selectedDate)
          dayBefore.setDate(dayBefore.getDate() - 1)
          
          const updatedEvent = {
            ...actualEvent,
            recurrence: {
              ...actualEvent.recurrence,
              endDate: dayBefore
            }
          }
          onUpdate(updatedEvent)
          toast.success('Future events deleted')
        }
      } else {
        // Normal deletion for non-recurring events
        await onDelete(event.id)
        toast.success('Event deleted')
      }
      onClose()
    } catch (error) {
      toast.error('Failed to delete event')
    } finally {
      setIsDeleting(false)
    }
  }

  const getEnergyColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-red-100 border-red-300 text-red-800'
      case 2: return 'bg-orange-100 border-orange-300 text-orange-800'
      case 3: return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      case 4: return 'bg-green-100 border-green-300 text-green-800'
      case 5: return 'bg-blue-100 border-blue-300 text-blue-800'
      default: return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  const getEnergyEmoji = (level: number) => {
    switch (level) {
      case 1: return '😴'
      case 2: return '😐'
      case 3: return '😊'
      case 4: return '😃'
      case 5: return '🤩'
      default: return '😊'
    }
  }

  const getImportanceColor = (level: number) => {
    switch (level) {
      case 1: return 'border-gray-400'
      case 2: return 'border-blue-400'
      case 3: return 'border-purple-400'
      case 4: return 'border-orange-400'
      case 5: return 'border-red-400'
      default: return 'border-gray-400'
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getProductivityIcon = (productivity?: number) => {
    if (!productivity) return null
    if (productivity >= 4) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (productivity >= 3) return <Target className="w-4 h-4 text-yellow-600" />
    return <AlertTriangle className="w-4 h-4 text-red-600" />
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event.title}
            {event.energyLevel && (
              <span className="text-sm">
                {getEnergyEmoji(event.energyLevel)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Image */}
          {event.pictures && event.pictures.length > 0 && (
            <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
              <img
                src={event.pictures[0]}
                alt={event.title}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          )}

          {/* Event Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Date & Time</Label>
              <p className="text-sm text-muted-foreground">
                {format(new Date(event.start), 'PPP')}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(event.start), 'p')} - {format(new Date(event.end), 'p')}
              </p>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Location</Label>
              <p className="text-sm text-muted-foreground">
                {event.location || 'No location specified'}
              </p>
            </div>
          </div>

          {/* Energy Level */}
          {event.energyLevel && (
            <div>
              <Label className="text-sm font-medium">Energy Level</Label>
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium",
                getEnergyColor(event.energyLevel)
              )}>
                <span>{getEnergyEmoji(event.energyLevel)}</span>
                <span>Level {event.energyLevel}</span>
              </div>
            </div>
          )}

          {/* Importance */}
          {event.importance && (
            <div>
              <Label className="text-sm font-medium">Importance</Label>
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full border-2",
                getImportanceColor(event.importance)
              )}>
                <span className="text-sm font-medium">Priority {event.importance}</span>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Tags</Label>
              <div className="flex flex-wrap gap-1">
                {event.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Checklist */}
          {event.checklist && event.checklist.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Checklist</Label>
              <div className="space-y-2">
                {event.checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox 
                      checked={item.completed} 
                      onCheckedChange={() => toggleChecklistItem(item.id)}
                    />
                    <span className={cn(
                      "text-sm",
                      item.completed && "line-through text-muted-foreground"
                    )}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reminders */}
          {event.reminders && event.reminders.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Reminders</Label>
              <div className="space-y-1">
                {event.reminders.map((reminder, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bell className="h-3 w-3" />
                    <span>
                      {reminder.timing === 'before' ? `${reminder.minutes} minutes before` : 
                       reminder.timing === 'after' ? `${reminder.minutes} minutes after` : 
                       'At start time'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurrence */}
          {event.recurrence && event.recurrence.type !== 'none' && (
            <div>
              <Label className="text-sm font-medium">Recurrence</Label>
              <p className="text-sm text-muted-foreground">
                {event.recurrence.type.charAt(0).toUpperCase() + event.recurrence.type.slice(1)}
                {event.recurrence.endDate && ` until ${format(new Date(event.recurrence.endDate), 'PPP')}`}
                {event.originalEvent && ` (Instance of recurring event)`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={() => onDuplicate(event)}>
            Duplicate
          </Button>
          <Button variant="outline" onClick={() => onEdit(event)}>
            Edit
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
