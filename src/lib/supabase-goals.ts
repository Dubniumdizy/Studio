import { supabase } from '@/lib/supabaseClient'
import type { Goal, Subject } from '@/lib/goals-data'

// --- Offline fallback utilities ---
const LS_SUBJECTS = 'goals_offline_subjects'
const LS_OPS = 'goals_offline_ops'

type OfflineOp =
  | { type: 'createSubject'; id: string; data: { name: string; startDate?: string | null; examDate?: string | null } }
  | { type: 'updateSubject'; id: string; data: { name?: string; startDate?: string | null; examDate?: string | null } }
  | { type: 'deleteSubjectCascade'; id: string }
  | { type: 'createGoal'; id: string; data: { subjectId: string; parentGoalId?: string | null; text: string; dueDate?: string | null; reminderDays?: number | null; current_value: number; target_value: number } }
  | { type: 'updateGoal'; id: string; data: { text?: string; dueDate?: string | null; reminderDays?: number | null; current_value?: number | null; target_value?: number | null } }
  | { type: 'toggleGoal'; id: string; completed: boolean }
  | { type: 'deleteGoal'; id: string }

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function safeWrite<T>(key: string, val: T) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

function genUUID(): string {
  // RFC4122 v4-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getOfflineSubjects(): Subject[] {
  return safeRead<Subject[]>(LS_SUBJECTS, [])
}
function setOfflineSubjects(subjects: Subject[]) {
  safeWrite(LS_SUBJECTS, subjects)
}
function getOps(): OfflineOp[] { return safeRead<OfflineOp[]>(LS_OPS, []) }
function pushOp(op: OfflineOp) { const ops = getOps(); ops.push(op); safeWrite(LS_OPS, ops) }
function clearOps() { safeWrite(LS_OPS, []) }

function applyOfflineCreateSubject(id: string, data: { name: string; startDate?: string | null; examDate?: string | null }): Subject {
  const subjects = getOfflineSubjects()
  const s: Subject = { id, name: data.name, startDate: data.startDate || undefined, examDate: data.examDate || undefined, goals: [] }
  subjects.push(s)
  setOfflineSubjects(subjects)
  return s
}
function applyOfflineUpdateSubject(id: string, patch: { name?: string; startDate?: string | null; examDate?: string | null }) {
  const subjects = getOfflineSubjects().map(s => s.id === id ? { ...s, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.startDate !== undefined ? { startDate: patch.startDate || undefined } : {}), ...(patch.examDate !== undefined ? { examDate: patch.examDate || undefined } : {}) } : s)
  setOfflineSubjects(subjects)
}
function applyOfflineDeleteSubjectCascade(id: string) {
  const subjects = getOfflineSubjects().filter(s => s.id !== id)
  setOfflineSubjects(subjects)
}

function applyOfflineCreateGoal(id: string, payload: { subjectId: string; parentGoalId?: string | null; text: string; dueDate?: string | null; reminderDays?: number | null; current_value: number; target_value: number }): Goal | null {
  const subjects = getOfflineSubjects()
  const subject = subjects.find(s => s.id === payload.subjectId)
  if (!subject) return null
  const newGoal: Goal = {
    id,
    text: payload.text,
    completed: false,
    subGoals: [],
    dueDate: payload.dueDate || undefined,
    reminderDays: payload.reminderDays || undefined,
    progressCurrent: payload.current_value,
    progressTotal: payload.target_value,
  }
  if (payload.parentGoalId) {
    const addToParent = (goals: Goal[]): boolean => {
      for (let g of goals) {
        if (g.id === payload.parentGoalId) {
          g.subGoals = [...(g.subGoals || []), newGoal]
          return true
        }
        if ((g.subGoals || []).length && addToParent(g.subGoals)) return true
      }
      return false
    }
    addToParent(subject.goals)
  } else {
    subject.goals = [...(subject.goals || []), newGoal]
  }
  setOfflineSubjects(subjects)
  return newGoal
}
function applyOfflineUpdateGoal(id: string, patch: { text?: string; dueDate?: string | null; reminderDays?: number | null; current_value?: number | null; target_value?: number | null }) {
  const subjects = getOfflineSubjects()
  const updateInTree = (goals: Goal[]): boolean => {
    for (let i = 0; i < goals.length; i++) {
      if (goals[i].id === id) {
        goals[i] = {
          ...goals[i],
          ...(patch.text !== undefined ? { text: patch.text } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate || undefined } : {}),
          ...(patch.reminderDays !== undefined ? { reminderDays: patch.reminderDays || undefined } : {}),
          ...(patch.current_value !== undefined ? { progressCurrent: patch.current_value || 0 } : {}),
          ...(patch.target_value !== undefined ? { progressTotal: patch.target_value || 1 } : {}),
        }
        return true
      }
      if ((goals[i].subGoals || []).length && updateInTree(goals[i].subGoals)) return true
    }
    return false
  }
  subjects.forEach(s => updateInTree(s.goals))
  setOfflineSubjects(subjects)
}
function applyOfflineToggleGoal(id: string, completed: boolean) {
  const subjects = getOfflineSubjects()
  const toggleInTree = (goals: Goal[]): boolean => {
    for (let g of goals) {
      if (g.id === id) { g.completed = completed; return true }
      if ((g.subGoals || []).length && toggleInTree(g.subGoals)) return true
    }
    return false
  }
  subjects.forEach(s => toggleInTree(s.goals))
  setOfflineSubjects(subjects)
}
function applyOfflineDeleteGoal(id: string) {
  const subjects = getOfflineSubjects()
  const removeInTree = (goals: Goal[]): [Goal[], boolean] => {
    let changed = false
    const filtered = goals.filter(g => {
      if (g.id === id) { changed = true; return false }
      return true
    }).map(g => {
      if ((g.subGoals || []).length) {
        const [subs, ch] = removeInTree(g.subGoals)
        if (ch) { changed = true; return { ...g, subGoals: subs } }
      }
      return g
    })
    return [filtered, changed]
  }
  subjects.forEach((s, idx) => {
    const [ng, _] = removeInTree(s.goals)
    subjects[idx] = { ...s, goals: ng }
  })
  setOfflineSubjects(subjects)
}

async function trySupabase<T extends { error?: any }>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: any; data?: T }> {
  try {
    const res = await fn()
    // Interpret PostgREST-style responses: if an error property exists and is truthy, treat as failure
    if ((res as any) && typeof (res as any) === 'object' && 'error' in (res as any) && (res as any).error) {
      return { ok: false, error: (res as any).error, data: res }
    }
    return { ok: true, data: res }
  } catch (e) {
    return { ok: false, error: e }
  }
}

export async function syncOfflineOps(userId: string) {
  const ops = getOps()
  if (!ops.length) return

  const isDuplicateKey = (err: any) => {
    try {
      const code = err?.code || err?.details?.code
      const msg = (err?.message || err?.details || '').toString().toLowerCase()
      return code === '23505' || msg.includes('duplicate key value')
    } catch { return false }
  }

  // attempt to replay ops in order
  const remaining: OfflineOp[] = []
  for (const op of ops) {
    if (op.type === 'createSubject') {
      const payload: any = { id: op.id, user_id: userId, name: op.data.name, start_date: op.data.startDate || null, exam_date: op.data.examDate || null }
      const res = await trySupabase(() => (supabase as any).from('subjects').insert(payload))
      if (!res.ok) { const err = (res as any).error; if (!isDuplicateKey(err)) { remaining.push(op); break } }
      // if duplicate key, treat as already synced and continue
    } else if (op.type === 'updateSubject') {
      const patch: any = {}
      if (op.data.name !== undefined) patch.name = op.data.name
      if (op.data.startDate !== undefined) patch.start_date = (op.data.startDate ? op.data.startDate : null)
      if (op.data.examDate !== undefined) patch.exam_date = (op.data.examDate ? op.data.examDate : null)
      const res = await trySupabase(() => (supabase as any).from('subjects').update(patch).eq('id', op.id))
      if (!res.ok) { remaining.push(op); break }
    } else if (op.type === 'deleteSubjectCascade') {
      const res1 = await trySupabase(() => (supabase as any).from('goals').delete().eq('subject_id', op.id))
      if (!res1.ok) { remaining.push(op); break }
      const res2 = await trySupabase(() => (supabase as any).from('subjects').delete().eq('id', op.id))
      if (!res2.ok) { remaining.push(op); break }
    } else if (op.type === 'createGoal') {
      const payload: any = {
        id: op.id,
        user_id: userId,
        subject_id: op.data.subjectId,
        parent_goal_id: op.data.parentGoalId ?? null,
        title: op.data.text,
        text: op.data.text,
        completed: false,
        due_date: op.data.dueDate ? op.data.dueDate : null,
        reminder_days: op.data.reminderDays ?? null,
        current_value: op.data.current_value,
        target_value: op.data.target_value,
        unit: 'count',
      }
      const res = await trySupabase(() => (supabase as any).from('goals').insert(payload))
      if (!res.ok) { const err = (res as any).error; if (!isDuplicateKey(err)) { remaining.push(op); break } }
    } else if (op.type === 'updateGoal') {
      const patch: any = {}
      if (op.data.text !== undefined) { patch.title = op.data.text; patch.text = op.data.text }
      if (op.data.dueDate !== undefined) patch.due_date = (op.data.dueDate ? op.data.dueDate : null)
      if (op.data.reminderDays !== undefined) patch.reminder_days = op.data.reminderDays
      if (op.data.current_value !== undefined) patch.current_value = op.data.current_value
      if (op.data.target_value !== undefined) patch.target_value = op.data.target_value
      const res = await trySupabase(() => (supabase as any).from('goals').update(patch).eq('id', op.id))
      if (!res.ok) { remaining.push(op); break }
    } else if (op.type === 'toggleGoal') {
      const res = await trySupabase(() => (supabase as any).from('goals').update({ completed: op.completed }).eq('id', op.id))
      if (!res.ok) { remaining.push(op); break }
    } else if (op.type === 'deleteGoal') {
      const res = await trySupabase(() => (supabase as any).from('goals').delete().eq('id', op.id))
      if (!res.ok) { remaining.push(op); break }
    }
  }

  if (remaining.length === 0) {
    clearOps()
  } else {
    // keep only the remaining ops (first failure and anything after)
    const idx = ops.indexOf(remaining[0])
    const rest = ops.slice(idx)
    safeWrite(LS_OPS, rest as any)
  }
}

export function getOfflineOpsCount(): number {
  try { return getOps().length } catch { return 0 }
}

export async function syncPendingOps(userId: string): Promise<number> {
  const before = getOfflineOpsCount()
  if (before === 0) return 0
  await syncOfflineOps(userId)
  const after = getOfflineOpsCount()
  return after
}

// Map DB rows to app types
function mapSubjectRow(row: any): Subject {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date || undefined,
    examDate: row.exam_date || undefined,
    goals: [],
  }
}

function mapGoalRow(row: any): Goal {
  return {
    id: row.id,
    // Support both legacy 'text' and current 'title' column names
    text: row.text ?? row.title,
    completed: !!row.completed,
    subGoals: [],
    notes: row.notes || undefined,
    dueDate: row.due_date || undefined,
    startTime: undefined,
    endTime: undefined,
    tags: row.tags || undefined,
    files: undefined,
    recurrence: undefined,
    recurrenceExceptions: undefined,
    recurrenceId: undefined,
    reminderDays: row.reminder_days ?? undefined,
    // Map DB numeric tracking fields into app fields
    progressCurrent: row.current_value ?? undefined,
    progressTotal: row.target_value ?? undefined,
  }
}

function buildGoalTree(rows: any[]): { roots: Goal[]; byId: Record<string, Goal>; childrenByParent: Record<string, Goal[]> } {
  const byId: Record<string, Goal> = {}
  const childrenByParent: Record<string, Goal[]> = {}

  rows.forEach(r => {
    const g = mapGoalRow(r)
    byId[g.id] = g
    const parent = r.parent_goal_id || null
    if (!childrenByParent[parent ?? 'root']) childrenByParent[parent ?? 'root'] = []
    childrenByParent[parent ?? 'root'].push(g)
  })

  // attach children
  Object.entries(childrenByParent).forEach(([parentKey, children]) => {
    if (parentKey === 'root') return
    const parent = byId[parentKey]
    if (parent) parent.subGoals = children
  })

  const roots = childrenByParent['root'] || []
  return { roots, byId, childrenByParent }
}

export async function fetchSubjectsWithGoals(userId: string): Promise<Subject[]> {
  // Try to flush any offline ops first (best-effort)
  await syncOfflineOps(userId)

  const [subjectsRes, goalsRes] = await Promise.all([
    supabase
      .from('subjects')
      .select('id,name,start_date,exam_date')
      .eq('user_id', userId),
    supabase
      .from('goals')
      // Select both title and text for backward compatibility
      .select('id,subject_id,parent_goal_id,title,text,completed,due_date,reminder_days,current_value,target_value,unit')
      .eq('user_id', userId),
  ])
  const { data: subjects, error: sErr } = subjectsRes
  const { data: goals, error: gErr } = goalsRes
  if (sErr || gErr) {
    // Offline fallback
    return getOfflineSubjects()
  }

  const subjectsById: Record<string, Subject> = {}
  ;(subjects || []).forEach(row => {
    const s = mapSubjectRow(row)
    subjectsById[s.id] = s
  })

  // group goals by subject
  const goalsBySubject: Record<string, any[]> = {}
  ;(goals || []).forEach(row => {
    const sid = row.subject_id
    if (!goalsBySubject[sid]) goalsBySubject[sid] = []
    goalsBySubject[sid].push(row)
  })

  const result: Subject[] = []
  for (const sRow of subjects || []) {
    const s = subjectsById[sRow.id]
    const rows = goalsBySubject[sRow.id] || []
    const tree = buildGoalTree(rows)
    s.goals = tree.roots
    result.push(s)
  }
  return result
}

export async function createSubject(userId: string, data: { name: string; startDate?: string; examDate?: string }) {
  // Generate an id client-side so we always know the inserted id even if SELECT is blocked by RLS
  const id = genUUID()
  const payload = {
    id,
    user_id: userId,
    name: data.name,
    start_date: data.startDate || null,
    exam_date: data.examDate || null,
  }
  // Minimize payload to reduce response size and latency
  const online = await trySupabase(() => (supabase as any)
    .from('subjects')
    .insert(payload)
    .select('id,name,start_date,exam_date')
    .single())
  if (online.ok) {
    const row = (online.data as any).data
    // If SELECT was blocked by policy and no row returned, synthesize from payload
    const fallbackRow = row ?? { id, name: data.name, start_date: data.startDate || null, exam_date: data.examDate || null }
    return mapSubjectRow(fallbackRow)
  }
  // Offline fallback
  const offline = applyOfflineCreateSubject(id, { name: data.name, startDate: data.startDate || null, examDate: data.examDate || null })
  pushOp({ type: 'createSubject', id, data: { name: data.name, startDate: data.startDate || null, examDate: data.examDate || null } })
  return offline
}

export async function updateSubject(subjectId: string, data: { name?: string; startDate?: string | null; examDate?: string | null }) {
  const patch: any = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.startDate !== undefined) patch.start_date = data.startDate || null
  if (data.examDate !== undefined) patch.exam_date = data.examDate || null
  const res = await trySupabase(() => (supabase as any).from('subjects').update(patch).eq('id', subjectId))
  if (!res.ok) {
    // Offline fallback
    applyOfflineUpdateSubject(subjectId, { name: data.name, startDate: data.startDate ?? null, examDate: data.examDate ?? null })
    pushOp({ type: 'updateSubject', id: subjectId, data: { name: data.name, startDate: data.startDate ?? null, examDate: data.examDate ?? null } })
  }
}

export async function deleteSubject(subjectId: string) {
  const res = await trySupabase(() => (supabase as any).from('subjects').delete().eq('id', subjectId))
  if (!res.ok) {
    applyOfflineDeleteSubjectCascade(subjectId)
    pushOp({ type: 'deleteSubjectCascade', id: subjectId })
  }
}

export async function deleteSubjectCascade(subjectId: string) {
  // Delete all goals under the subject first to avoid FK constraint errors
  const delGoals = await trySupabase(() => (supabase as any).from('goals').delete().eq('subject_id', subjectId))
  const delSubj = delGoals.ok ? await trySupabase(() => (supabase as any).from('subjects').delete().eq('id', subjectId)) : delGoals
  if (!delSubj.ok) {
    // Offline fallback
    applyOfflineDeleteSubjectCascade(subjectId)
    pushOp({ type: 'deleteSubjectCascade', id: subjectId })
  }
}

export async function createGoal(userId: string, data: { subjectId: string; parentGoalId?: string | null; text: string; dueDate?: string; reminderDays?: number; progressCurrent?: number; progressTotal?: number }) {
  // Generate an id client-side so we always know the inserted id even if SELECT is blocked by RLS
  const id = genUUID()

  // Ensure DB NOT NULL constraints are satisfied even when progress tracking isn't explicitly used
  const currentVal = typeof data.progressCurrent === 'number' ? data.progressCurrent : 0
  const targetVal = typeof data.progressTotal === 'number' ? data.progressTotal : 1

  const payload: any = {
    id, // provide id explicitly so we can synthesize a fallback row if SELECT is blocked
    user_id: userId,
    subject_id: data.subjectId,
    parent_goal_id: data.parentGoalId ?? null,
    // Write to 'title' to satisfy NOT NULL constraint; also include 'text' for compatibility
    title: data.text,
    text: data.text,
    completed: false,
    // Provide a default unit to satisfy NOT NULL constraint in DB
    unit: 'count',
    current_value: currentVal,
    target_value: targetVal,
  }
  if (data.dueDate !== undefined) payload.due_date = data.dueDate || null
  if (data.reminderDays !== undefined) payload.reminder_days = data.reminderDays

  const online = await trySupabase(() => (supabase as any)
    .from('goals')
    .insert(payload)
    .select('id,parent_goal_id,title,text,completed,due_date,reminder_days,current_value,target_value,unit')
    .single())

  if (online.ok) {
    const resp = (online.data as any)
    const row = resp?.data
    if (row && row.id) {
      return mapGoalRow(row)
    }
    // Fallback when SELECT is blocked by policy (insert succeeded but no returning row)
    const fallbackRow = {
      id,
      parent_goal_id: data.parentGoalId ?? null,
      title: data.text,
      text: data.text,
      completed: false,
      due_date: data.dueDate ?? null,
      reminder_days: data.reminderDays ?? null,
      current_value: currentVal,
      target_value: targetVal,
      unit: 'count',
    }
    return mapGoalRow(fallbackRow)
  }

  // Online insert failed (RLS or other). Offline fallback: create locally with the same generated UUID id
  const created = applyOfflineCreateGoal(id, {
    subjectId: data.subjectId,
    parentGoalId: data.parentGoalId ?? null,
    text: data.text,
    dueDate: data.dueDate ?? null,
    reminderDays: data.reminderDays ?? null,
    current_value: currentVal,
    target_value: targetVal,
  })
  if (created) {
    pushOp({ type: 'createGoal', id, data: { subjectId: data.subjectId, parentGoalId: data.parentGoalId ?? null, text: data.text, dueDate: data.dueDate ?? null, reminderDays: data.reminderDays ?? null, current_value: created.progressCurrent ?? 0, target_value: created.progressTotal ?? 1 } })
    return created
  }
  // if subject not found locally, throw original-like error
  throw (online as any).error || new Error('Failed to create goal offline')
}

export async function updateGoal(goalId: string, data: { text?: string; dueDate?: string | null; reminderDays?: number | null; progressCurrent?: number | null; progressTotal?: number | null }) {
  const patch: any = {}
  if (data.text !== undefined) {
    // Update both columns for compatibility
    patch.title = data.text
    patch.text = data.text
  }
  if (data.dueDate !== undefined) patch.due_date = data.dueDate
  if (data.reminderDays !== undefined) patch.reminder_days = data.reminderDays
  if (data.progressCurrent !== undefined) patch.current_value = data.progressCurrent ?? 0
  if (data.progressTotal !== undefined) patch.target_value = data.progressTotal ?? 1
  const res = await trySupabase(() => (supabase as any).from('goals').update(patch).eq('id', goalId))
  if (!res.ok) {
    applyOfflineUpdateGoal(goalId, {
      text: data.text,
      dueDate: data.dueDate ?? null,
      reminderDays: data.reminderDays ?? null,
      current_value: data.progressCurrent ?? null,
      target_value: data.progressTotal ?? null,
    })
    pushOp({ type: 'updateGoal', id: goalId, data: { text: data.text, dueDate: data.dueDate ?? null, reminderDays: data.reminderDays ?? null, current_value: data.progressCurrent ?? null, target_value: data.progressTotal ?? null } })
  }
}

export async function toggleGoal(goalId: string, completed: boolean) {
  const res = await trySupabase(() => (supabase as any).from('goals').update({ completed }).eq('id', goalId))
  if (!res.ok) {
    applyOfflineToggleGoal(goalId, completed)
    pushOp({ type: 'toggleGoal', id: goalId, completed })
  }
}

export async function deleteGoal(goalId: string) {
  const res = await trySupabase(() => (supabase as any).from('goals').delete().eq('id', goalId))
  if (!res.ok) {
    applyOfflineDeleteGoal(goalId)
    pushOp({ type: 'deleteGoal', id: goalId })
  }
}

