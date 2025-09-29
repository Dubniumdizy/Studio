import { type EnhancedCalendarEvent } from '@/types/enhanced-calendar'

/**
 * Validates if a date value is valid and not empty
 */
export function isValidDateValue(value: any): boolean {
  if (!value) return false
  const date = new Date(value)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Sanitizes an event update patch to ensure valid data
 */
export function sanitizeEventPatch(event: Partial<EnhancedCalendarEvent>): Partial<EnhancedCalendarEvent> {
  const sanitized = { ...event }
  
  // Validate start time
  if (!isValidDateValue(event.start)) {
    delete sanitized.start
  }

  // Validate end time
  if (!isValidDateValue(event.end)) {
    delete sanitized.end
  }

  // Ensure valid recurrence data
  if (sanitized.recurrence) {
    if (sanitized.recurrence.endDate && !isValidDateValue(sanitized.recurrence.endDate)) {
      delete sanitized.recurrence.endDate
    }
    
    if (!['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(sanitized.recurrence.type)) {
      sanitized.recurrence.type = 'none'
    }
  }

  return sanitized
}
