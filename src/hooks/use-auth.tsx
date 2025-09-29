'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { authService } from '@/lib/services/auth'
import { supabase } from '@/lib/supabaseClient'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: { display_name?: string; avatar_url?: string }) => Promise<void>
}

interface LocalUser {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Local storage keys
const LOCAL_USER_KEY = 'studyverse_user'
const LOCAL_SESSION_KEY = 'studyverse_session'

// Helper functions for local storage
const getLocalUser = (): LocalUser | null => {
  if (typeof window === 'undefined') return null
  try {
    const userStr = localStorage.getItem(LOCAL_USER_KEY)
    return userStr ? JSON.parse(userStr) : null
  } catch {
    return null
  }
}

const setLocalUser = (user: LocalUser | null) => {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
      localStorage.setItem(LOCAL_SESSION_KEY, 'active')
    } else {
      localStorage.removeItem(LOCAL_USER_KEY)
      localStorage.removeItem(LOCAL_SESSION_KEY)
    }
  } catch (error) {
    console.error('Failed to save user to localStorage:', error)
  }
}

const isLocalSessionActive = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(LOCAL_SESSION_KEY) === 'active'
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Determine if we're using placeholder Supabase (development mode) based on env
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isUsingPlaceholder = !SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('placeholder')
  
  // Force mock authentication only when explicitly requested or when placeholder is used
  const useMockFlag = typeof window !== 'undefined' ? (window as any).env?.NEXT_PUBLIC_USE_MOCK_AUTH ?? process.env.NEXT_PUBLIC_USE_MOCK_AUTH : process.env.NEXT_PUBLIC_USE_MOCK_AUTH
  const forceMockAuth = (useMockFlag === 'true') || isUsingPlaceholder

  // Only run localStorage logic on client after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (forceMockAuth) {
      const localUser = getLocalUser()
      if (localUser && isLocalSessionActive()) {
        const supabaseUser: User = {
          id: localUser.id,
          email: localUser.email,
          created_at: localUser.created_at,
          updated_at: localUser.updated_at,
          user_metadata: {
            display_name: localUser.display_name,
            avatar_url: localUser.avatar_url
          },
          app_metadata: {},
          aud: 'authenticated',
          role: 'authenticated'
        }
        setUser(supabaseUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    } else {
      // Use real Supabase
      let canceled = false

      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (canceled) return
          setUser(session?.user ?? null)
        })
        .catch((err) => {
          console.error('Supabase getSession error:', err)
        })
        .finally(() => {
          if (!canceled) setLoading(false)
        })

      const timeout = setTimeout(() => {
        if (!canceled) setLoading(false)
      }, 2000)

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (canceled) return
        setUser(session?.user ?? null)
        setLoading(false)
      })

      return () => {
        canceled = true
        clearTimeout(timeout)
        subscription.unsubscribe()
      }
    }
  }, []); // Only run once on mount

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      if (forceMockAuth) {
        // Simulate authentication for development
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate network delay
        
        // Check against mock users for demo credentials
        const mockUsers = [
          { email: 'gardener@studyverse.app', password: 'password123' },
          { email: 'student@example.com', password: 'password123' }
        ]
        
        const mockUser = mockUsers.find(u => u.email === email && u.password === password)
        
        if (!mockUser) {
          throw new Error('Invalid email or password. Please check your credentials and try again.')
        }
        
        // Try to get existing user from localStorage
        let localUser = getLocalUser()
        if (!localUser || localUser.email !== email) {
          // Create a mock user
          localUser = {
            id: `user_${Date.now()}`,
            email,
            display_name: email.split('@')[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
        setLocalUser(localUser)
        // Convert to Supabase User format
        const supabaseUser: User = {
          id: localUser.id,
          email: localUser.email,
          created_at: localUser.created_at,
          updated_at: localUser.updated_at,
          user_metadata: {
            display_name: localUser.display_name
          },
          app_metadata: {},
          aud: 'authenticated',
          role: 'authenticated'
        }
        setUser(supabaseUser)
      } else {
        await authService.signIn(email, password)
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      const message =
        (typeof error?.message === 'string' && /Invalid login credentials/i.test(error.message))
          ? 'Invalid email or password. If you have not created an account yet, please sign up first.'
          : (error?.message || 'Unable to sign in. Please try again.')
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    setLoading(true)
    try {
      if (forceMockAuth) {
        // Simulate registration for development
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate network delay
        // Create a mock user
        const mockUser: LocalUser = {
          id: `user_${Date.now()}`,
          email,
          display_name: displayName || email.split('@')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setLocalUser(mockUser)
        // Convert to Supabase User format
        const supabaseUser: User = {
          id: mockUser.id,
          email: mockUser.email,
          created_at: mockUser.created_at,
          updated_at: mockUser.updated_at,
          user_metadata: {
            display_name: mockUser.display_name
          },
          app_metadata: {},
          aud: 'authenticated',
          role: 'authenticated'
        }
        setUser(supabaseUser)
      } else {
        await authService.signUp(email, password, displayName)
      }
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      if (forceMockAuth) {
        setLocalUser(null)
        setUser(null)
      } else {
        await authService.signOut()
        setUser(null)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    try {
      if (forceMockAuth) {
        // Update local storage
        const localUser = getLocalUser()
        if (localUser) {
          const updatedUser: LocalUser = {
            ...localUser,
            ...updates,
            updated_at: new Date().toISOString()
          }
          setLocalUser(updatedUser)
          
          // Update state
          const supabaseUser: User = {
            ...user!,
            user_metadata: {
              ...user!.user_metadata,
              ...updates
            },
            updated_at: updatedUser.updated_at
          }
          setUser(supabaseUser)
        }
      } else {
        await authService.updateProfile(updates)
      }
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
