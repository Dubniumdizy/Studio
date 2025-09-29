import { supabase } from './supabaseClient';
import type { 
  Subject, 
  FlashcardDeck, 
  Flashcard, 
  Goal, 
  CalendarEvent, 
  Note, 
  StudySession
} from './supabase';

export class DatabaseService {
  // Test database connection
  static async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase.from('subjects').select('count').limit(1);
      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  // SUBJECTS
  static async getSubjects(userId: string): Promise<Subject[]> {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject> {
    const { data, error } = await supabase
      .from('subjects')
      .insert(subject)
      .select()
      .single();
    
    if (error) throw error;
    return data as Subject;
  }

  static async updateSubject(id: string, updates: Partial<Subject>): Promise<Subject> {
    const { data, error } = await supabase
      .from('subjects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Subject;
  }

  static async deleteSubject(id: string): Promise<void> {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getSubjectBySlug(userId: string, slug: string): Promise<Subject | null> {
    const { data, error } = await (supabase as any)
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return data as Subject | null
  }

  // FLASHCARD DECKS
  static async getFlashcardDecks(userId: string): Promise<FlashcardDeck[]> {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createFlashcardDeck(deck: Omit<FlashcardDeck, 'id' | 'created_at' | 'updated_at'>): Promise<FlashcardDeck> {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .insert(deck)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateFlashcardDeck(id: string, updates: Partial<FlashcardDeck>): Promise<FlashcardDeck> {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteFlashcardDeck(id: string): Promise<void> {
    const { error } = await supabase
      .from('flashcard_decks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // FLASHCARDS
  static async getFlashcards(deckId: string): Promise<Flashcard[]> {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createFlashcard(flashcard: Omit<Flashcard, 'id' | 'created_at' | 'updated_at'>): Promise<Flashcard> {
    const { data, error } = await supabase
      .from('flashcards')
      .insert(flashcard)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateFlashcard(id: string, updates: Partial<Flashcard>): Promise<Flashcard> {
    const { data, error } = await supabase
      .from('flashcards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteFlashcard(id: string): Promise<void> {
    const { error } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Update flashcard performance after review
  static async updateFlashcardPerformance(
    id: string, 
    correct: boolean, 
    responseTime?: number
  ): Promise<Flashcard> {
    // Fetch current flashcard
    const { data: current, error: fetchError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Calculate new values
    const reviews = (current.review_count || 0) + 1;
    const correctAnswers = (current.correct_count || 0) + (correct ? 1 : 0);
    const accuracy = reviews > 0 ? (correctAnswers / reviews) * 100 : 0;
    
    // Update difficulty based on performance (simple algorithm)
    let newDifficulty = current.difficulty || 1;
    if (correct) {
      newDifficulty = Math.max(1, newDifficulty - 0.1);
    } else {
      newDifficulty = Math.min(5, newDifficulty + 0.3);
    }
    
    // Calculate next review date (spaced repetition)
    const nextReview = new Date();
    const daysToAdd = Math.max(1, Math.floor(newDifficulty * (correct ? 2 : 0.5)));
    nextReview.setDate(nextReview.getDate() + daysToAdd);

    const updates = {
      review_count: reviews,
      correct_count: correctAnswers,
      accuracy_percentage: Math.round(accuracy),
      difficulty: newDifficulty,
      last_reviewed: new Date().toISOString(),
      next_review: nextReview.toISOString(),
      ...(responseTime && { average_response_time: responseTime })
    };

    return this.updateFlashcard(id, updates);
  }

  // GOALS
  static async getGoals(userId: string): Promise<Goal[]> {
    const { data, error } = await supabase
      .from('goals')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals')
      .insert(goal)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteGoal(id: string): Promise<void> {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // CALENDAR EVENTS
  static async getCalendarEvents(
    userId: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<CalendarEvent[]> {
    let query = supabase
      .from('calendar_events')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('user_id', userId);
    
    if (startDate) query = query.gte('start', startDate);
    if (endDate) query = query.lte('end', endDate);
    
    const { data, error } = await query.order('start', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  static async createCalendarEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>): Promise<CalendarEvent> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteCalendarEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // NOTES
  static async getNotes(userId: string, subjectId?: string): Promise<Note[]> {
    let query = supabase
      .from('notes')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('user_id', userId);
    
    if (subjectId) query = query.eq('subject_id', subjectId);
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteNote(id: string): Promise<void> {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // STUDY SESSIONS
  static async getStudySessions(userId: string, subjectId?: string): Promise<StudySession[]> {
    let query = supabase
      .from('study_sessions')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('user_id', userId);
    
    if (subjectId) query = query.eq('subject_id', subjectId);
    
    const { data, error } = await query.order('started_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createStudySession(session: Omit<StudySession, 'id' | 'created_at' | 'updated_at'>): Promise<StudySession> {
    const { data, error } = await supabase
      .from('study_sessions')
      .insert(session)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateStudySession(id: string, updates: Partial<StudySession>): Promise<StudySession> {
    const { data, error } = await supabase
      .from('study_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteStudySession(id: string): Promise<void> {
    const { error } = await supabase
      .from('study_sessions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // ANALYTICS & INSIGHTS
  static async getStudyAnalytics(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get study sessions for the period
    const { data: sessions, error: sessionsError } = await supabase
      .from('study_sessions')
      .select(`
        *,
        subject:subjects(name, color)
      `)
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .order('start_time', { ascending: true });
    
    if (sessionsError) throw sessionsError;

    // Get flashcard reviews for the period
    const { data: flashcards, error: flashcardsError } = await supabase
      .from('flashcards')
      .select(`
        review_count,
        correct_count,
        accuracy_percentage,
        deck:flashcard_decks(name, subject:subjects(name))
      `)
      .gte('last_reviewed', startDate.toISOString());
    
    if (flashcardsError) throw flashcardsError;

    // Get goals progress
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    if (goalsError) throw goalsError;

    return {
      studySessions: sessions || [],
      flashcardStats: flashcards || [],
      activeGoals: goals || [],
      period: { days, startDate: startDate.toISOString() }
    };
  }

  // BULK OPERATIONS
  static async bulkCreateFlashcards(flashcards: Omit<Flashcard, 'id' | 'created_at' | 'updated_at'>[]): Promise<Flashcard[]> {
    const { data, error } = await supabase
      .from('flashcards')
      .insert(flashcards)
      .select();
    
    if (error) throw error;
    return data;
  }

  // SUBJECT VOCABULARY (Concepts/Confidence/Importance)
  static async getSubjectVocab(userId: string, subjectSlug: string) {
    const { data, error } = await supabase
      .from('subject_vocab')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_slug', subjectSlug)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  }
  static async upsertSubjectVocab(userId: string, subjectSlug: string, entry: { id?: string; concept: string; confidence: number; importance: number; notes?: string }) {
    const concept = (entry.concept || '').trim()
    const confidence = Number(entry.confidence)
    const importance = Number(entry.importance)
    const notes = entry.notes ?? null

    const isDupErr = (err: any) => {
      try {
        const code = err?.code || err?.details?.code
        const msg = (err?.message || err?.details || '').toString().toLowerCase()
        return code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')
      } catch { return false }
    }

    // If we have an id, try a direct update first
    if (entry.id) {
      const { data: updatedArr, error: updErr } = await (supabase as any)
        .from('subject_vocab')
        .update({ concept, confidence, importance, notes })
        .eq('id', entry.id)
        .eq('user_id', userId)
        .select()

      if (!updErr) {
        const updated = Array.isArray(updatedArr) ? updatedArr[0] : updatedArr
        return updated ?? { id: entry.id, user_id: userId, subject_slug: subjectSlug, concept, confidence, importance, notes }
      }

      // If the update failed due to unique conflict (another row already has this concept), merge: update existing row and delete the old one
      if (isDupErr(updErr)) {
        const { data: existingArr, error: findErr } = await (supabase as any)
          .from('subject_vocab')
          .select('*')
          .eq('user_id', userId)
          .eq('subject_slug', subjectSlug)
          .ilike('concept', concept)
        if (findErr) throw findErr
        const existingRows = Array.isArray(existingArr) ? existingArr : (existingArr ? [existingArr] : [])
        if (existingRows.length > 0) {
          // Choose canonical row (oldest by created_at, else first)
          existingRows.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
          const canonical = existingRows[0]
          // Update canonical with new values
          const { data: mergedArr, error: mergeErr } = await (supabase as any)
            .from('subject_vocab')
            .update({ confidence, importance, notes })
            .eq('id', canonical.id)
            .eq('user_id', userId)
            .select()
          if (mergeErr) throw mergeErr
          const merged = Array.isArray(mergedArr) ? mergedArr[0] : mergedArr
          // Delete other duplicates including the old row id (best-effort)
          const toDeleteIds = existingRows.map((r: any) => r.id).filter((id: string) => id !== canonical.id)
          if (entry.id && entry.id !== canonical.id) toDeleteIds.push(entry.id)
          if (toDeleteIds.length) {
            try { await (supabase as any).from('subject_vocab').delete().in('id', Array.from(new Set(toDeleteIds))).eq('user_id', userId) } catch {}
          }
          return merged
        }
      }
      // Not a duplicate conflict or could not merge; rethrow original error
      throw updErr
    }

    // No id: attempt upsert by (user_id, subject_slug, concept)
    const payload: any = { user_id: userId, subject_slug: subjectSlug, concept, confidence, importance, notes }
    const { data, error } = await (supabase as any)
      .from('subject_vocab')
      .upsert(payload, { onConflict: 'user_id,subject_slug,concept' })
      .select()

    if (!error && data) {
      const arr = Array.isArray(data) ? data : (data ? [data] : [])
      return arr[0] || null
    }

    // If upsert hit a unique conflict (e.g., expression index like lower(concept)), fallback to updating the existing row
    if (error && isDupErr(error)) {
      const { data: existingArr, error: findErr } = await (supabase as any)
        .from('subject_vocab')
        .select('*')
        .eq('user_id', userId)
        .eq('subject_slug', subjectSlug)
        .ilike('concept', concept)
      if (findErr) throw findErr
      const existingRows = Array.isArray(existingArr) ? existingArr : (existingArr ? [existingArr] : [])
      if (existingRows.length > 0) {
        existingRows.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        const canonical = existingRows[0]
        const { data: mergedArr, error: mergeErr } = await (supabase as any)
          .from('subject_vocab')
          .update({ confidence, importance, notes })
          .eq('id', canonical.id)
          .eq('user_id', userId)
          .select()
        if (mergeErr) throw mergeErr
        const merged = Array.isArray(mergedArr) ? mergedArr[0] : mergedArr
        // Clean up other duplicates best-effort
        const toDeleteIds = existingRows.map((r: any) => r.id).filter((id: string) => id !== canonical.id)
        if (toDeleteIds.length) {
          try { await (supabase as any).from('subject_vocab').delete().in('id', Array.from(new Set(toDeleteIds))).eq('user_id', userId) } catch {}
        }
        return merged
      }
    }

    if (error) throw error
    return data
  }
  static async deleteSubjectVocab(userId: string, id: string) {
    const { error } = await supabase.from('subject_vocab').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  }

  // SUBJECT RESOURCES (links to BANK)
  static async getSubjectResources(userId: string, subjectSlug: string) {
    const { data, error } = await supabase
      .from('subject_resources')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_slug', subjectSlug)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  }
  static async addSubjectResource(userId: string, subjectSlug: string, resource: { name: string; bank_item_id?: string; bank_path?: string; bank_type?: string; url?: string }) {
    const { data, error } = await supabase
      .from('subject_resources')
      .insert({ user_id: userId, subject_slug: subjectSlug, name: resource.name, bank_item_id: resource.bank_item_id ?? null, bank_path: resource.bank_path ?? null, bank_type: resource.bank_type ?? null, url: resource.url ?? null })
      .select()
      .single()
    if (error) throw error
    return data
  }
  static async deleteSubjectResource(userId: string, id: string) {
    const { error } = await supabase.from('subject_resources').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  }

  static async searchNotes(userId: string, query: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  // Get upcoming events and deadlines
  static async getUpcomingItems(userId: string, days: number = 7) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    const [eventsResult, goalsResult] = await Promise.allSettled([
      supabase
        .from('calendar_events')
        .select(`
          *,
          subject:subjects(*)
        `)
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true }),
      
      supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .lte('target_date', endDate.toISOString())
        .order('target_date', { ascending: true })
    ]);

    return {
      events: eventsResult.status === 'fulfilled' ? eventsResult.value.data || [] : [],
      goals: goalsResult.status === 'fulfilled' ? goalsResult.value.data || [] : []
    };
  }
}

export default DatabaseService;
