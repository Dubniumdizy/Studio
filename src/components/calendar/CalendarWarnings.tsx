"use client"

import React, { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { studySessionTracker } from "@/lib/study-sessions"

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x }

export function CalendarWarnings({ selectedDate }: { selectedDate?: Date }) {
  const warnings = useMemo(() => {
    const items: { id: string; text: string }[] = []

    const day = selectedDate ?? new Date()
    const sessions = studySessionTracker.getSessions({ startDate: startOfDay(day), endDate: endOfDay(day) })
    if (sessions.length > 0) {
      const meanEnergy = sessions.reduce((s, v) => s + v.energyLevel, 0) / sessions.length
      if (meanEnergy < 2.5) {
        items.push({ id: 'low-energy', text: 'Low energy day: average energy below 2.5' })
      }
    }

    const today = startOfDay(new Date())
    const dayMinus1 = new Date(today); dayMinus1.setDate(today.getDate() - 1)
    const dayMinus2 = new Date(today); dayMinus2.setDate(today.getDate() - 2)
    const hadDayMinus1 = studySessionTracker.getSessions({ startDate: startOfDay(dayMinus1), endDate: endOfDay(dayMinus1) }).length > 0
    const hadDayMinus2 = studySessionTracker.getSessions({ startDate: startOfDay(dayMinus2), endDate: endOfDay(dayMinus2) }).length > 0
    if (!hadDayMinus1 && !hadDayMinus2) {
      items.push({ id: 'no-study-2days', text: 'No study activity in the last two days' })
    }

    return items
  }, [selectedDate])

  if (warnings.length === 0) return null

  return (
    <div className="space-y-2">
      {warnings.map(w => (
        <div key={w.id} className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 p-2 text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
          <span className="text-sm">{w.text}</span>
        </div>
      ))}
    </div>
  )
}

