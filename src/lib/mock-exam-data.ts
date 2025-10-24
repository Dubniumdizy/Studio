import { supabase } from './supabaseClient';

export interface MockExamSession {
  id: string;
  user_id: string;
  exam_title: string;
  number_of_questions?: number;
  time_taken_minutes?: number;
  grade?: 'F' | 'E' | 'D' | 'C' | 'B' | 'A';
  used_solution: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamQuestion {
  questionNumber: number;
  question: string;
  solution: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const LOCAL_KEY = 'mock_exam_sessions_local';

function loadLocal(): MockExamSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(list: MockExamSession[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch {}
}

function createLocalSession(params: {
  exam_title: string;
  number_of_questions: number;
  time_taken_minutes: number;
  grade: 'F' | 'E' | 'D' | 'C' | 'B' | 'A';
  used_solution: boolean;
}): MockExamSession {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    user_id: 'local',
    exam_title: params.exam_title,
    number_of_questions: params.number_of_questions,
    time_taken_minutes: params.time_taken_minutes,
    grade: params.grade,
    used_solution: params.used_solution,
    created_at: now,
    updated_at: now,
  };
}

export class MockExamService {
  // Save exam session after completion
  static async saveExamSession(params: {
    exam_title: string;
    number_of_questions: number;
    time_taken_minutes: number;
    grade: 'F' | 'E' | 'D' | 'C' | 'B' | 'A';
    used_solution: boolean;
  }): Promise<MockExamSession> {
    // Try Supabase; on any failure, persist locally and return
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id || (session as any)?.user?.id;
      if (!uid) {
        const local = createLocalSession(params);
        const list = [local, ...loadLocal()];
        saveLocal(list);
        return local;
      }

      const { data, error: insertError } = await (supabase as any)
        .from('mock_exam_sessions')
        .insert({
          user_id: uid,
          exam_title: params.exam_title,
          number_of_questions: params.number_of_questions,
          time_taken_minutes: params.time_taken_minutes,
          grade: params.grade,
          used_solution: params.used_solution,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data as MockExamSession;
    } catch (e) {
      const local = createLocalSession(params);
      const list = [local, ...loadLocal()];
      saveLocal(list);
      return local;
    }
  }

  // Get all exam sessions for current user
  static async getExamSessions(): Promise<MockExamSession[]> {
    const local = loadLocal();
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id || (session as any)?.user?.id;
      if (!uid) return local; // Return local if not authenticated

      const { data, error: queryError } = await (supabase as any)
        .from('mock_exam_sessions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (queryError) return local;
      return ([...(data || []) as MockExamSession[], ...local]).sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch {
      return local;
    }
  }

  // Get sessions for analytics/charting
  static async getExamSessionsStats(): Promise<MockExamSession[]> {
    const local = loadLocal();
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id || (session as any)?.user?.id;
      if (!uid) return local;

      const { data } = await (supabase as any)
        .from('mock_exam_sessions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });

      return ([...(data || []) as MockExamSession[], ...local]).sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch {
      return local;
    }
  }

  // Delete an exam session
  static async deleteExamSession(id: string): Promise<void> {
    // If local id, remove from local cache only
    if (id.startsWith('local-')) {
      const next = loadLocal().filter(s => s.id !== id);
      saveLocal(next);
      return;
    }
    const { error } = await (supabase as any)
      .from('mock_exam_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
