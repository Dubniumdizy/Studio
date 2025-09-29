
"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { slugify } from "@/lib/slug";
import type { Subject } from "@/lib/supabase";
import DatabaseService from "@/lib/database";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";


export default function SubjectSetupPage() {
  const [subjects, setSubjects] = React.useState<Subject[]>([])
  const router = useRouter()
  const [editing, setEditing] = React.useState<Partial<Subject> | null>(null)
  const [showEditor, setShowEditor] = React.useState(false)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [isSaving, setIsSaving] = React.useState<boolean>(false)
  const { toast } = useToast()

  React.useEffect(()=>{
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const uid = sess?.session?.user?.id ?? null
        setUserId(uid)
        if (!uid) {
          setSubjects([])
          return
        }
        try {
          const rows = await DatabaseService.getSubjects(uid)
          setSubjects(rows)
        } catch (e: any) {
          console.warn('Failed to load subjects from Supabase', e)
          const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e))
          toast({ title: 'Failed to load subjects', description: raw })
        }
      } catch (e) {
        console.warn('Auth session error', e)
      } finally { setLoading(false) }
    })()
  }, [])

  const refresh = React.useCallback(async () => {
    if (!userId) return
    try {
      const rows = await DatabaseService.getSubjects(userId)
      // Merge by slug first (prefer server), then by id for any rows without slug
      let mergedLen = 0
      setSubjects(prev => {
        const bySlug = new Map<string, Subject>()
        rows.forEach(r => { if (r.slug) bySlug.set(r.slug, r) })
        prev.forEach(p => {
          const key = p.slug || ''
          if (key && !bySlug.has(key)) bySlug.set(key, p)
        })
        // Add any without slug, de-dupe by id
        const withNoSlugServer = rows.filter(r => !r.slug)
        const withNoSlugPrev = prev.filter(p => !p.slug)
        const byId = new Map<string, Subject>()
        withNoSlugServer.forEach(r => byId.set(r.id, r))
        withNoSlugPrev.forEach(p => { if (!byId.has(p.id)) byId.set(p.id, p) })
        const merged = [...Array.from(bySlug.values()), ...Array.from(byId.values())]
        mergedLen = merged.length
        return merged
      })
      // Debug length toast outside render/update phase
      try { setTimeout(() => toast({ title: 'Debug (after refresh)', description: `subjects.length=${mergedLen}` }), 0) } catch {}
    } catch (e: any) {
      console.warn('Failed to refresh subjects', e)
      const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e))
      toast({ title: 'Failed to refresh subjects', description: raw })
    }
  }, [userId])

  // Realtime subscription to subjects for the current user
  React.useEffect(() => {
    if (!userId) return
    try {
      const ch = (supabase as any)
        .channel(`subjects:${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subjects', filter: `user_id=eq.${userId}` }, (payload: any) => {
          const row = payload.new as Subject
          let nextLen = 0
          setSubjects(prev => {
            if (prev.find(s => s.id === row.id)) return prev
            const filtered = prev.filter(s => (s.slug || '') !== row.slug)
            const next = [row, ...filtered]
            nextLen = next.length
            return next
          })
          try { setTimeout(() => toast({ title: 'Debug (realtime insert)', description: `subjects.length=${nextLen}` }), 0) } catch {}
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'subjects', filter: `user_id=eq.${userId}` }, (payload: any) => {
          const row = payload.new as Subject
          setSubjects(prev => prev.map(s => s.id === row.id ? row : s))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'subjects', filter: `user_id=eq.${userId}` }, (payload: any) => {
          const row = payload.old as Subject
          setSubjects(prev => prev.filter(s => s.id !== row.id))
        })
        .subscribe()
      return () => { try { (supabase as any).removeChannel(ch) } catch {} }
    } catch {}
  }, [userId])

  const startNew = () => {
    setEditing({ id: '', name: '', description: '', color: 'bg-green-200' })
    setShowEditor(true)
  }
  const startEdit = (s: Subject) => { setEditing({ ...s }); setShowEditor(true) }
  const save = async () => {
    if (!editing) return
    const name = (editing.name || '').toString().trim() || 'Untitled'
    const color = (editing.color || 'bg-green-200').toString()
    const description = (editing.description || '').toString()
    const baseSlug = slugify(name)
    const currentSlugs = subjects.map(s => (s.slug || slugify(s.name)))
    const makeUniqueSlug = (slug: string, existing: string[]) => {
      if (!existing.includes(slug)) return slug
      let i = 2
      while (existing.includes(`${slug}-${i}`)) i++
      return `${slug}-${i}`
    }
    const uniqueSlug = editing?.id
      ? makeUniqueSlug(baseSlug, currentSlugs.filter(s=> s !== (editing.slug || slugify(editing.name||''))))
      : makeUniqueSlug(baseSlug, currentSlugs)

    if (!userId) {
      toast({ title: 'Sign in required', description: 'Please sign in to create subjects.' })
      return
    }
    setIsSaving(true)
    try {
      if (editing.id) {
        const updated = await DatabaseService.updateSubject(editing.id, { name, description, color, slug: uniqueSlug })
        setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s))
        toast({ title: 'Subject updated' })
        setShowEditor(false)
        refresh()
      } else {
        // Create on server; if it fails, show error and do not add a temporary row
        try {
          const created = await DatabaseService.createSubject({ user_id: userId, name, description, color, slug: uniqueSlug } as any)
          if (created && created.id) {
            let nextLen = 0
            setSubjects(prev => {
              // Remove any temp rows with same slug, then insert created
              const filtered = prev.filter(s => (s.slug || '') !== created.slug)
              const next = [created, ...filtered]
              nextLen = next.length
              return next
            })
            try { setTimeout(() => toast({ title: 'Debug (after insert)', description: `subjects.length=${nextLen}` }), 0) } catch {}
            toast({ title: 'Subject created' })
            toast({ title: 'Debug (created row)', description: JSON.stringify(created) })
            // Navigate to the new subject immediately for confirmation
            try { router.push(`/subjects/${created.slug}`) } catch {}
            // Poll for confirmation in case replication/filters delay the refresh
            ;(async () => {
              try {
                for (let i = 0; i < 4; i++) {
                  const row = await DatabaseService.getSubjectBySlug(userId!, created.slug)
                  if (row) { try { toast({ title: 'Debug (confirmed by poll)', description: row.id }) } catch {}; break }
                  await new Promise(r => setTimeout(r, 400))
                }
              } catch {}
            })()
          } else {
            // Fallback: show a local temp row to keep UX consistent
            const temp: Subject = {
              id: `temp-${Date.now()}`,
              user_id: userId,
              name,
              slug: uniqueSlug,
              description,
              color,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as Subject
            let nextLen = 0
            setSubjects(prev => {
              const next = [temp, ...prev]
              nextLen = next.length
              return next
            })
            try { setTimeout(() => toast({ title: 'Debug (after insert local)', description: `subjects.length=${nextLen}` }), 0) } catch {}
            toast({ title: 'Subject created (local)' })
            toast({ title: 'Debug (created row)', description: 'no server row returned' })
          }
          setShowEditor(false)
          setTimeout(() => { refresh() }, 800)
        } catch (e: any) {
          console.warn('Create subject failed', e)
          const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e))
          const friendly = /duplicate|unique/i.test(raw) ? 'A subject with a similar name already exists. Try a different name.' : raw
          toast({ title: 'Create failed', description: friendly })
          toast({ title: 'Debug (Supabase)', description: raw })
        }
      }
    } catch (e: any) {
      console.warn('Save failed (outer)', e)
      const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e))
      toast({ title: 'Save failed', description: raw })
    } finally {
      setIsSaving(false)
    }
  }
  const remove = async (id: string) => {
    try {
      await DatabaseService.deleteSubject(id)
      await refresh()
      toast({ title: 'Subject deleted' })
    } catch (e: any) {
      console.warn('Failed to delete subject', e)
      const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e))
      toast({ title: 'Delete failed', description: raw })
    }
  }


  return (
    <div>
      <div className="flex justify-between items-center">
        <PageHeader 
          title="Subject Setup"
          description="Create, edit, and manage all your subjects here."
        />
        <Button onClick={startNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Subject
        </Button>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((subject: Subject) => (
    <Card key={subject.id} className="flex flex-col hover:shadow-lg transition-shadow">
            <Link href={`/subjects/${subject.slug || slugify(subject.name)}`} className="flex-grow flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-ellipsis overflow-hidden whitespace-nowrap">
                  <span className={`w-4 h-4 rounded-full ${subject.color}`} />
                  <span className="truncate">{subject.name}</span>
                </CardTitle>
                <CardDescription className="mt-2 line-clamp-2" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{subject.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Manage tools & knowledge map for this subject.
                </p>
              </CardContent>
            </Link>
            <CardFooter className="flex justify-between gap-2 pt-4 border-t bg-muted/50">
              <div className="flex gap-2 ml-auto">
                <Button variant="ghost" size="sm" onClick={()=>startEdit(subject)}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={()=>remove(subject.id)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
              </div>
            </CardFooter>
          </Card>
        ))}
        <Card className="flex items-center justify-center border-2 border-dashed bg-muted/50 hover:border-primary/50 transition-colors">
            <Button variant="ghost" className="w-full h-full flex-col gap-2 py-10" onClick={startNew} disabled={!userId}>
                <PlusCircle className="h-8 w-8 text-muted-foreground"/>
                <span className="text-muted-foreground">{userId ? 'Add New Subject' : 'Sign in to add subjects'}</span>
            </Button>
        </Card>
      </div>

      {/* Editor */}
      {showEditor && editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-background rounded-md shadow-xl w-full max-w-lg p-4 space-y-3">
            <div className="text-lg font-semibold">{editing.id ? 'Edit Subject' : 'New Subject'}</div>
            <div className="grid gap-2">
              <label className="text-sm">Name
                <input className="w-full bg-transparent border rounded px-2 py-1" value={editing.name || ''} onChange={e=>setEditing({...editing, name: e.target.value})} />
              </label>
              <label className="text-sm">Description
                <textarea className="w-full bg-transparent border rounded px-2 py-1" value={editing.description || ''} onChange={e=>setEditing({...editing, description: e.target.value})} />
              </label>
              <label className="text-sm">Color (Tailwind bg-*)
                <input className="w-full bg-transparent border rounded px-2 py-1" value={editing.color || ''} onChange={e=>setEditing({...editing, color: e.target.value})} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={()=>setShowEditor(false)}>Cancel</Button>
              <Button onClick={save} disabled={isSaving || !userId}><PlusCircle className="h-4 w-4 mr-1" /> {isSaving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
