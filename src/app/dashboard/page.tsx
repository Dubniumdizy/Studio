'use client'

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { QuickLinksWidget } from "@/components/dashboard/quick-links-widget";
import { QuickNotesWidget } from "@/components/dashboard/notes-widget";
import { StudyStatisticsWidget } from "@/components/dashboard/stats-widget";
import { StudyTimerWidget } from "@/components/dashboard/study-timer-widget";
import { TodaysTasksWidget } from "@/components/dashboard/todo-list-widget";
import { UpcomingEventsWidget } from "@/components/dashboard/upcoming-events-widget";
import { Lock, Plus, HelpCircle } from "lucide-react";
import { useState } from "react";
import { QuestionsWidget } from "@/components/dashboard/questions-widget";

export default function DashboardPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [extras, setExtras] = useState<{ id: string; type: 'questions' }[]>([])

  const addQuestions = () => {
    setExtras(prev => [{ id: `questions-${Date.now()}`, type: 'questions' }, ...prev])
    setShowAdd(false)
  }
  const removeExtra = (id: string) => setExtras(prev => prev.filter(x => x.id !== id))

  return (
    <div className="flex-1 space-y-6">
      <div className="flex justify-between items-start">
        <PageHeader 
          title="Dashboard" 
          description="Here's a snapshot of your study world. Nurture your goals and watch your knowledge grow." 
        />
        <Button variant={unlocked ? 'default' : 'outline'} onClick={() => setUnlocked(v => !v)}>
            <Lock className="mr-2 h-4 w-4" />
            {unlocked ? 'Lock Widgets' : 'Unlock Widgets'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <QuickNotesWidget />
        <TodaysTasksWidget />
        <UpcomingEventsWidget />
        <StudyStatisticsWidget />
        <StudyTimerWidget />
        <QuickLinksWidget />
        {extras.map(w => (
          <div key={w.id} className={`relative ${unlocked ? 'ring-2 ring-primary/20' : ''}`}>
            <div className="absolute -top-2 -right-2 flex gap-1" hidden={!unlocked}>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeExtra(w.id)} title="Remove">
                ×
              </Button>
            </div>
            {w.type === 'questions' && <QuestionsWidget />}
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-6">
        <div className="space-y-2">
          <Button variant="outline" className="bg-background" onClick={() => setShowAdd(v => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            {showAdd ? 'Close' : 'Add Widget'}
          </Button>
          {showAdd && (
            <div className="mt-2 p-3 border rounded bg-card text-sm grid gap-2">
              <div className="font-medium">Available widgets</div>
              <Button variant="outline" size="sm" onClick={addQuestions}>
                <HelpCircle className="mr-2 h-4 w-4" /> Questions (per subject)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
