import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Browser-side client. Requires env vars to be set:
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Check if we should use offline mode
const isOfflineMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')

if (isOfflineMode) {
  console.warn('🔧 Running in offline mode - Supabase features will use localStorage fallback')
}

// Mock Supabase client for offline development
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
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
    update: () => ({ data: null, error: null }),
    delete: () => ({ data: null, error: null })
  })
} as any)

export const supabase = isOfflineMode 
  ? createOfflineClient()
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })

