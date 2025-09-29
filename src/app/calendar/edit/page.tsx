"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { styleFromTags, hasDeadlineTag, markEventAsDeadline, unmarkEventAsDeadline } from '@/lib/calendar-bridge'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

// Minimal type for calendar events
type CalEvent = {
  id: string
  title: string
  start?: string | null
  end?: string | null
  start_time?: string | null
  end_time?: string | null
  tags?: string[] | null
  work_type?: string | null
}

export default function CalendarEditIndexPage() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const searchParams = useSearchParams()
  const debugMode = (searchParams?.get('debug') === '1')

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        setLoading(true)
        const { data } = await supabase.auth.getSession()
        const userId = data.session?.user?.id
        if (!userId) { setError('Not signed in'); setLoading(false); return }
        const { data: rows, error } = await (supabase as any)
          .from('calendar_events')
          .select('id,title,start,end,start_time,end_time,tags,work_type')
          .eq('user_id', userId)
          .order('start_time', { ascending: true })
        if (error) throw error
        if (!alive) return
        setEvents(rows || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load events')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return events
    return events.filter(e => (e.title || '').toLowerCase().includes(term))
  }, [events, q])

  const setDeadline = async (evt: CalEvent) => {
    try {
      await markEventAsDeadline(evt.id)
      const add = ['deadline','duedate','theme:black','fg:white','color:locked:black']
      const set = new Set([...(evt.tags || []), ...add])
      setEvents(es => es.map(e => e.id === evt.id ? { ...e, tags: Array.from(set) } : e))
    } catch (e: any) {
      setError(e?.message || 'Failed to set deadline')
    }
  }
  const removeDeadline = async (evt: CalEvent) => {
    try {
      await unmarkEventAsDeadline(evt.id)
      const remove = new Set(['deadline','duedate','theme:black','fg:white','color:locked:black'])
      const next = (evt.tags || []).filter(t => !remove.has(t))
      setEvents(es => es.map(e => e.id === evt.id ? { ...e, tags: next } : e))
    } catch (e: any) {
      setError(e?.message || 'Failed to remove deadline')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendar • Edit Events</h1>
        <div className="w-64">
          <Label htmlFor="search" className="sr-only">Search</Label>
          <Input id="search" placeholder="Search events…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No events found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(evt => {
            const style = styleFromTags(evt.tags || [])
            const deadline = hasDeadlineTag(evt.tags || [])
            return (
              <div key={evt.id} className="flex items-center justify-between gap-3 border rounded p-3" style={style}>
                <div>
                  <div className="font-medium">{evt.title}</div>
                  <div className="text-xs opacity-80">{evt.start ?? evt.start_time} – {evt.end ?? evt.end_time}</div>
                  <div className="text-xs">tags: {(evt.tags || []).join(', ') || 'none'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setDeadline(evt)} variant={deadline ? 'default' : 'outline'} disabled={deadline}>
                    Deadline
                  </Button>
                  {debugMode && deadline && (
                    <Button onClick={() => removeDeadline(evt)} variant={'destructive'}>Remove (debug)</Button>
                  )}
                  <Link href={`/calendar/edit/${evt.id}`} className={cn(buttonVariants({ variant: 'outline' }))}>Advanced…</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

