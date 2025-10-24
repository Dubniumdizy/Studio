import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Check if we should use offline mode
const isOfflineMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

// Mock client for offline development
const createOfflineClient = (): Partial<SupabaseClient> => ({
  auth: {
    getSession: async () => ({ 
      data: { 
        session: {
          user: {
            id: 'offline-user',
            email: 'user@offline.local',
            user_metadata: { display_name: 'Offline User' }
          }
        } 
      }, 
      error: null 
    }),
    signUp: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => ({ 
      data: { 
        user: {
          id: 'offline-user',
          email: 'user@offline.local',
          user_metadata: { display_name: 'Offline User' }
        }
      }, 
      error: null 
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null })
  },
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null })
  })
} as any)

// For client-side operations (simplified for now)
export function createClient() {
  if (isOfflineMode) {
    console.warn('🔧 Creating offline Supabase client')
    return createOfflineClient()
  }
  
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
}

// Types for our database tables
export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
  display_name?: string
  avatar_url?: string
}

export interface Subject {
  id: string
  user_id: string
  name: string
  slug: string
  color: string
  description?: string
  created_at: string
  updated_at: string
}

export interface FlashcardDeck {
  id: string
  user_id: string
  subject_id?: string
  name: string
  description?: string
  cards_count: number
  srs_good_interval: number
  srs_easy_interval: number
  archive_days: number
  created_at: string
  updated_at: string
}

export interface Flashcard {
  id: string
  deck_id: string
  front: string
  back: string
  front_image?: string
  back_image?: string
  difficulty: 'again' | 'good' | 'easy' | null
  last_reviewed?: string | null
  next_review?: string | null
  created_at: string
  updated_at: string
}

export interface StudySession {
  id: string
  user_id: string
  subject_id?: string
  activity_type: 'flashcards' | 'notes' | 'mock-exam' | 'study-timer'
  duration_minutes: number
  started_at: string
  ended_at: string
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description?: string
  target_value: number
  current_value: number
  unit: string
  deadline?: string
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description?: string
  start: string
  end: string
  event_type?: 'study' | 'exam' | 'deadline' | 'break' | 'other'
  subject_id?: string
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  subject_id?: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}
