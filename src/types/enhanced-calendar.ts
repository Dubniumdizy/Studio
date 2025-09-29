export interface EnhancedCalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  allDay?: boolean
  color?: string
  recurrence?: RecurrenceRule
  location?: string
  attendees?: string[]
  reminders?: Reminder[]
  tags?: string[]
  files?: FileAttachment[]
  notes?: string
  completed?: boolean
  
  // Enhanced features
  energyLevel?: 1 | 2 | 3 | 4 | 5  // Energy outline 1-5
  studyDifficulty?: 1 | 2 | 3 | 4 | 5 // User-rated study difficulty 1-5 (separate from energy)
  importance?: 1 | 2 | 3 | 4 | 5    // Importance showing in activity
  pictures?: string[]               // Picture uploads
  checklist?: ChecklistItem[]       // Checklist for event
  isHabit?: boolean                 // Special tag for habit tracking
  habitStreak?: number              // Current habit streak
  timeSpent?: number                // Actual time spent (in minutes)
  plannedDuration?: number          // Planned duration (in minutes)
  burnoutRisk?: 'low' | 'medium' | 'high'  // Burnout warning level
  workType?: 'deep' | 'shallow' | 'break' | 'personal'  // Type of work
  moodBefore?: 1 | 2 | 3 | 4 | 5    // Mood before activity
  moodAfter?: 1 | 2 | 3 | 4 | 5     // Mood after activity
  productivity?: 1 | 2 | 3 | 4 | 5  // Productivity rating
  savedAsFile?: boolean             // If event is saved as file in BANK
  isRecurring?: boolean             // Whether this is a recurring event
  originalId?: string               // ID of the original event for recurring instances
  originalEvent?: EnhancedCalendarEvent  // Reference to the original event for instances
  
  // Layout properties for calendar display
  layout?: {
    left: number
    width: number
    col: number
    totalCols: number
  }
}

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  createdAt: Date
}

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'none'
  interval?: number
  endDate?: Date
  count?: number
  byDay?: number[]
  skipDates?: Date[]
}

export interface Reminder {
  id: string
  type: 'notification' | 'email'
  minutes: number
  timing?: 'before' | 'after'  // When the reminder should trigger relative to the event
  acknowledged?: boolean
  sentAt?: Date
  isActive?: boolean
}

export interface FileAttachment {
  id: string
  name: string
  url: string
  size: number
  type: string
}

// Analytics interfaces
export interface TimeAnalytics {
  totalTime: number
  byTag: { [tag: string]: number }
  byTimeOfDay: { morning: number, midday: number, evening: number, night: number }
  burnoutScore: number
  wellnessScore: number
  productivity: number
  mostActiveTime: 'morning' | 'midday' | 'evening' | 'night'
}

export interface HabitProgress {
  habitTag: string
  streak: number
  completedThisWeek: number
  targetPerWeek: number
  totalCompleted: number
  lastCompleted?: Date
}

// To-do list interface
export interface TodoItem {
  id: string
  text: string
  priority: 'low' | 'medium' | 'high'
  estimatedTime?: number  // in minutes
  tags?: string[]
  deadline?: Date
  category: 'soon' | 'later' | 'someday'
  createdAt: Date
  completed: boolean
}

// Weekly analytics interface
export interface WeeklyAnalytics {
  weekStart: Date
  weekEnd: Date
  totalStudyTime: number
  totalWorkTime: number
  totalFunTime: number
  totalBreakTime: number
  averageEnergyLevel: number
  averageProductivity: number
  habitsCompleted: HabitProgress[]
  warnings: string[]
  achievements: string[]
  advice: string[]
  burnoutRisk: 'low' | 'medium' | 'high'
  wellnessScore: number
}

// Recommended time allocations
export interface TimeRecommendations {
  movement: number      // hours per week
  relaxation: number    // hours per week
  eating: number        // hours per week
  sleep: number         // hours per day
  studyWork: number     // hours per day
  planning: number      // hours per week
  social: number        // hours per week
}

// Chore templates
export interface ChoreTemplate {
  id: string
  name: string
  estimatedTime: number  // in minutes
  frequency: 'daily' | 'weekly' | 'monthly'
  tags: string[]
  category: 'cleaning' | 'admin' | 'health' | 'social' | 'maintenance'
  description?: string
}

// Calendar analytics
export interface CalendarAnalytics {
  timeAnalytics: TimeAnalytics
  habitProgress: HabitProgress[]
  weeklyAnalytics: WeeklyAnalytics
  recommendations: TimeRecommendations
  warnings: {
    tooManyTags: boolean
    burnoutRisk: boolean
    lowWellness: boolean
    badTimeBalance: boolean
  }
}

// Default chore templates
export const DEFAULT_CHORE_TEMPLATES: ChoreTemplate[] = [
  { id: 'chore-email', name: 'Check Email', estimatedTime: 30, frequency: 'daily', tags: ['admin'], category: 'admin' },
  { id: 'chore-clean', name: 'Clean House', estimatedTime: 120, frequency: 'weekly', tags: ['cleaning'], category: 'cleaning' },
  { id: 'chore-mealprep', name: 'Meal Prep', estimatedTime: 90, frequency: 'weekly', tags: ['cooking', 'health'], category: 'health' },
  { id: 'chore-groceries', name: 'Get Groceries', estimatedTime: 60, frequency: 'weekly', tags: ['shopping', 'food'], category: 'health' },
  { id: 'chore-cooking', name: 'Cook Meal', estimatedTime: 45, frequency: 'daily', tags: ['cooking'], category: 'health' },
  { id: 'chore-taxes', name: 'Handle Taxes', estimatedTime: 180, frequency: 'monthly', tags: ['admin', 'finance'], category: 'admin' },
  { id: 'chore-social', name: 'Social Time', estimatedTime: 120, frequency: 'weekly', tags: ['fun', 'social'], category: 'social' },
  { id: 'chore-exercise', name: 'Exercise', estimatedTime: 60, frequency: 'daily', tags: ['health', 'movement'], category: 'health' },
]

// Time recommendations
export const DEFAULT_TIME_RECOMMENDATIONS: TimeRecommendations = {
  movement: 7,        // 1 hour per day
  relaxation: 10,     // ~1.5 hours per day
  eating: 7,          // 1 hour per day
  sleep: 8,           // 8 hours per day
  studyWork: 8,       // 8 hours per day
  planning: 1,        // 1 hour per week
  social: 8,          // ~1 hour per day
}
