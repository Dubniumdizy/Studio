
export type SubjectConfig = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string; // tailwind bg color token or hex used for accent dot
};

export type VocabEntry = {
  id: string;
  term: string;
  mustKnow: boolean; // whether this is essential
  confidence: number; // 0-5
  notes?: string;
};

export const mockSubjects: SubjectConfig[] = [
  {
    id: '1',
    slug: 'mathematics',
    name: 'Mathematics',
    description: 'Covering topics from algebra to calculus.',
    color: 'bg-blue-200'
  },
  {
    id: '2',
    slug: 'physics',
    name: 'Physics',
    description: 'Exploring the laws of motion, energy, and the universe.',
    color: 'bg-green-200'
  },
  {
    id: '3',
    slug: 'history',
    name: 'History',
    description: 'Analyzing past events and their impact on the present.',
    color: 'bg-yellow-200'
  }
];

// Local persistence helpers (works offline and without Supabase). If Supabase is present
// elsewhere, that can be integrated later.
const KEY = 'subjectsData'
export function getSubjects(): SubjectConfig[] {
  if (typeof window === 'undefined') return [...mockSubjects]
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return [...mockSubjects]
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : [...mockSubjects]
  } catch {
    return [...mockSubjects]
  }
}
export function saveSubjects(list: SubjectConfig[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
}
export function upsertSubject(input: Omit<SubjectConfig,'id'|'slug'> & { id?: string; slug?: string }) {
  const list = getSubjects()
  let id = input.id || `sub-${Date.now()}`
  let slug = input.slug || slugify(input.name)
  const idx = list.findIndex(s=>s.id===id)
  const next: SubjectConfig = { id, slug, name: input.name, description: input.description, color: input.color }
  if (idx>=0) list[idx] = next; else list.push(next)
  saveSubjects(list)
  return next
}
export function deleteSubject(id: string) {
  const list = getSubjects().filter(s=>s.id!==id)
  saveSubjects(list)
}
export function getSubjectBySlug(slug: string): SubjectConfig | null {
  const s = getSubjects().find(s=>s.slug===slug)
  return s || null
}
export function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || `subject-${Date.now()}`
}

// Vocabulary per subject (stored separately)
function vocabKey(subjectId: string) { return `subjectVocab_${subjectId}` }
export function getVocab(subjectId: string): VocabEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(vocabKey(subjectId))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
export function saveVocab(subjectId: string, entries: VocabEntry[]) {
  try { localStorage.setItem(vocabKey(subjectId), JSON.stringify(entries)) } catch {}
}
export function addVocab(subjectId: string, term: string) {
  const list = getVocab(subjectId)
  const entry: VocabEntry = { id: `voc-${Date.now()}`, term, mustKnow: true, confidence: 0 }
  const next = [...list, entry]
  saveVocab(subjectId, next)
  return entry
}
export function updateVocab(subjectId: string, entry: VocabEntry) {
  const list = getVocab(subjectId)
  const idx = list.findIndex(v=>v.id===entry.id)
  if (idx>=0) list[idx] = entry
  saveVocab(subjectId, list)
  return entry
}
export function removeVocab(subjectId: string, id: string) {
  const next = getVocab(subjectId).filter(v=>v.id!==id)
  saveVocab(subjectId, next)
}
