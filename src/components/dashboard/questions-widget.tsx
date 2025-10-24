'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpCircle, Trash2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import DatabaseService from '@/lib/database'
import { getSubjects as getLocalSubjects } from '@/lib/subjects'

export function QuestionsWidget() {
  type SubjectOpt = { id: string; name: string }
  type QuestionItem = { id: string; text: string; createdAt: string; resolved?: boolean }
  const STORE_KEY = 'subject_questions_store'

  const [subjects, setSubjects] = useState<SubjectOpt[]>([])
  const [selected, setSelected] = useState<string>('')
  const [text, setText] = useState('')
  const [store, setStore] = useState<Record<string, QuestionItem[]>>({})

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const uid = data?.session?.user?.id
        if (uid) {
          try {
            const rows = await DatabaseService.getSubjects(uid as any)
            const opts = (rows || []).map((r: any) => ({ id: r.id, name: r.name || 'Untitled' }))
            setSubjects(opts)
            if (!selected && opts.length) setSelected(opts[0].id)
            return
          } catch {}
        }
      } catch {}
      try {
        const locals = getLocalSubjects().map(s => ({ id: s.id, name: s.name }))
        setSubjects(locals)
        if (!selected && locals.length) setSelected(locals[0].id)
      } catch { setSubjects([]) }
    })()
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      setStore(raw ? JSON.parse(raw) : {})
    } catch { setStore({}) }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)) } catch {}
  }, [store])

  const list: QuestionItem[] = useMemo(() => store[selected] || [], [store, selected])

  const addQuestion = () => {
    const t = text.trim()
    if (!selected || !t) return
    const item: QuestionItem = { id: `q-${Date.now()}`, text: t, createdAt: new Date().toISOString(), resolved: false }
    setStore(prev => ({ ...prev, [selected]: [item, ...(prev[selected] || [])] }))
    setText('')
  }
  const removeQuestion = (id: string) => {
    setStore(prev => ({ ...prev, [selected]: (prev[selected] || []).filter(q => q.id !== id) }))
  }
  const toggleResolved = (id: string) => {
    setStore(prev => ({ ...prev, [selected]: (prev[selected] || []).map(q => q.id===id ? { ...q, resolved: !q.resolved } : q) }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="h-5 w-5" /> Questions to Ask
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {subjects.length === 0 ? (
          <div className="text-xs text-muted-foreground">No subjects found. Create a subject first.</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <select
                className="w-full border rounded px-2 py-1 text-xs bg-background"
                value={selected}
                onChange={e => setSelected(e.target.value)}
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <textarea
                className="w-full border rounded px-2 py-1 text-xs min-h-[60px]"
                placeholder="Write a question you want to remember to ask later..."
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <Button size="sm" className="w-full" onClick={addQuestion}>
                <HelpCircle className="h-3 w-3 mr-1" /> Save Question
              </Button>
            </div>
            <div className="space-y-2">
              {list.length === 0 ? (
                <div className="text-xs text-muted-foreground">No saved questions for this subject yet.</div>
              ) : (
                <ul className="space-y-2">
                  {list.map(q => (
                    <li key={q.id} className="p-2 border rounded text-xs flex items-start justify-between gap-2 bg-muted/30">
                      <div>
                        <div className={q.resolved ? 'line-through text-muted-foreground' : ''}>{q.text}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{new Date(q.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleResolved(q.id)} title={q.resolved ? 'Mark as open' : 'Mark as resolved'}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQuestion(q.id)} title="Delete">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}