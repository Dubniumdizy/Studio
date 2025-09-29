import { supabase } from '../supabaseClient'
import type { Subject, Goal, CalendarEvent, Note, StudySession } from '../supabase'

export class DatabaseService {

  // Subject operations
  async createSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('subjects')
      .insert(subject)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getUserSubjects(userId: string) {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (error) throw error
    return data
  }

  async updateSubject(subjectId: string, updates: Partial<Subject>) {
    const { data, error } = await supabase
      .from('subjects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', subjectId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteSubject(subjectId: string) {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', subjectId)

    if (error) throw error
  }

  // Goal operations
  async createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('goals')
      .insert(goal)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getUserGoals(userId: string) {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }

  async updateGoal(goalId: string, updates: Partial<Goal>) {
    const { data, error } = await supabase
      .from('goals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', goalId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteGoal(goalId: string) {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)

    if (error) throw error
  }

  // Calendar operations
  async createEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getUserEvents(userId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)

    if (startDate) {
      query = query.gte('start', startDate)
    }
    if (endDate) {
      query = query.lte('end', endDate)
    }

    const { data, error } = await query.order('start', { ascending: true })

    if (error) throw error
    return data
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>) {
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteEvent(eventId: string) {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)

    if (error) throw error
  }

  // Notes operations
  async createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getUserNotes(userId: string, subjectId?: string) {
    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)

    if (subjectId) {
      query = query.eq('subject_id', subjectId)
    }

    const { data, error } = await query.order('updated_at', { ascending: false })

    if (error) throw error
    return data
  }

  async updateNote(noteId: string, updates: Partial<Note>) {
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteNote(noteId: string) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)

    if (error) throw error
  }

  async searchNotes(userId: string, query: string) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data
  }

  // Study session tracking
  async createStudySession(session: Omit<StudySession, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('study_sessions')
      .insert(session)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getUserStudyStats(userId: string, days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: false })

    if (error) throw error
    return data
  }

  // Analytics
  async getDashboardStats(userId: string) {
    const today = new Date()
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
    
    // Get total study time this week
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('duration_minutes')
      .eq('user_id', userId)
      .gte('started_at', startOfWeek.toISOString())

    const totalStudyTime = sessions?.reduce((sum, session) => sum + session.duration_minutes, 0) || 0

    // Get total flashcard decks
    const { count: deckCount } = await supabase
      .from('flashcard_decks')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    // Get active goals
    const { count: activeGoals } = await supabase
      .from('goals')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_completed', false)

    // Get upcoming events (next 7 days)
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    
    const { count: upcomingEvents } = await supabase
      .from('calendar_events')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', nextWeek.toISOString())

    return {
      totalStudyTimeThisWeek: totalStudyTime,
      totalDecks: deckCount || 0,
      activeGoals: activeGoals || 0,
      upcomingEvents: upcomingEvents || 0
    }
  }
}

export const databaseService = new DatabaseService()
