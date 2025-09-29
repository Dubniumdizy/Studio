"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { styleFromTags, hasDeadlineTag, markEventAsDeadline, unmarkEventAsDeadline } from '@/lib/calendar-bridge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Minimal event type from calendar_events
type CalEvent = {
  id: string
  title: string
  description?: string | null
  start?: string | null
  end?: string | null
  start_time?: string | null
  end_time?: string | null
  all_day?: boolean | null
  tags?: string[] | null
  work_type?: string | null
}

export default function EditCalendarEventPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = (params as any)?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [evt, setEvt] = useState<CalEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const debugMode = (searchParams?.get('debug') === '1')

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        setLoading(true)
        const { data, error } = await (supabase as any)
          .from('calendar_events')
          .select('id,title,description,start,end,start_time,end_time,all_day,tags,work_type')
          .eq('id', eventId)
          .maybeSingle()
        if (error) throw error
        if (!alive) return
        if (!data) {
          setError('Event not found')
          setEvt(null)
        } else {
          setEvt(data as CalEvent)
          setError(null)
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load event')
      } finally {
        if (alive) setLoading(false)
      }
    }
    if (eventId) run()
    return () => { alive = false }
  }, [eventId])

  const style = useMemo(() => styleFromTags(evt?.tags || []), [evt?.tags])
  const deadlineActive = useMemo(() => hasDeadlineTag(evt?.tags || []), [evt?.tags])

  const handleTitleChange = (v: string) => setEvt(e => (e ? { ...e, title: v } : e))

  const handleSave = async () => {
    if (!evt) return
    try {
      setSaving(true)
      const patch: any = { title: evt.title }
      const { error } = await (supabase as any)
        .from('calendar_events')
        .update(patch)
        .eq('id', evt.id)
      if (error) throw error
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDeadline = async () => {
    if (!evt) return
    try {
      await markEventAsDeadline(evt.id)
      const add = ['deadline','duedate','theme:black','fg:white','color:locked:black']
      const set = new Set([...(evt.tags || []), ...add])
      setEvt({ ...evt, tags: Array.from(set) })
    } catch (e: any) {
      setError(e?.message || 'Failed to set deadline')
    }
  }

  const handleRemoveDeadline = async () => {
    if (!evt) return
    try {
      await unmarkEventAsDeadline(evt.id)
      const remove = new Set(['deadline','duedate','theme:black','fg:white','color:locked:black'])
      const next = (evt.tags || []).filter(t => !remove.has(t))
      setEvt({ ...evt, tags: next })
    } catch (e: any) {
      setError(e?.message || 'Failed to remove deadline')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Event</h1>
        <Button variant="outline" onClick={() => router.back()}>Back</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : !evt ? (
        <div className="text-sm">Event not found</div>
      ) : (
        <>
          {/* Preview block with enforced styling from tags */}
          <div className="rounded border p-4" style={style}>
            <div className="text-sm uppercase tracking-wide opacity-70">Preview</div>
            <div className="text-lg font-semibold">{evt.title || 'Untitled event'}</div>
            <div className="text-xs opacity-80">{evt.start ?? evt.start_time} – {evt.end ?? evt.end_time}</div>
            <div className="text-xs mt-1">tags: {(evt.tags || []).join(', ') || 'none'}</div>
          </div>

          {/* Basic editing */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={evt.title || ''} onChange={e => handleTitleChange(e.target.value)} />
            </div>
          </div>

          {/* Advanced: Deadline button */}
          <div className="space-y-2 border rounded p-4">
            <div className="text-sm font-medium">Advanced</div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSetDeadline} variant={deadlineActive ? 'default' : 'outline'} disabled={deadlineActive}>
                Deadline
              </Button>
              {debugMode && deadlineActive && (
                <Button onClick={handleRemoveDeadline} variant={'destructive'}>Remove (debug)</Button>
              )}
              <div className="text-xs text-muted-foreground">
                Deadline forces black background and white text and overrides energy colors.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </>
      )}
    </div>
  )
}

