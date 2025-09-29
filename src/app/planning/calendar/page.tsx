"use client"

import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { CalendarWarnings } from "@/components/calendar/CalendarWarnings"

export default function PlanningCalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Planning / Calendar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="p-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Warnings section under planning/calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Warnings</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarWarnings selectedDate={selectedDate} />
        </CardContent>
      </Card>
    </div>
  )
}

