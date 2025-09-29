"use client"

import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StickyNote } from "lucide-react"

export function QuickNotesWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="w-5 h-5" />
          Quick Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea placeholder="Jot down quick thoughts..." className="h-24 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent" />
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm" disabled>Save Options</Button>
        <Button variant="ghost" size="sm" disabled>Save Note</Button>
      </CardFooter>
    </Card>
  )
}

// Re-export with the name used by WidgetGrid
export { QuickNotesWidget as NotesWidget }
