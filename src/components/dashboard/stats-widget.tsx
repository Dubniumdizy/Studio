"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BarChart3 } from "lucide-react"
import Link from "next/link"

export function StudyStatisticsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5" />
          Study Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Today</span>
            <span className="font-bold text-lg">2.5 hours</span>
        </div>
        <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">This week</span>
            <span className="font-bold text-lg">18 hours</span>
        </div>
        <Progress value={60} className="h-2" />
        <Link href="/analytics" className="text-sm text-primary hover:underline">
          View detailed stats →
        </Link>
      </CardContent>
    </Card>
  )
}

// Re-export with the name used by WidgetGrid
export { StudyStatisticsWidget as StatsWidget }
