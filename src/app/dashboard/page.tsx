
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { QuickLinksWidget } from "@/components/dashboard/quick-links-widget";
import { QuickNotesWidget } from "@/components/dashboard/notes-widget";
import { StudyStatisticsWidget } from "@/components/dashboard/stats-widget";
import { StudyTimerWidget } from "@/components/dashboard/study-timer-widget";
import { TodaysTasksWidget } from "@/components/dashboard/todo-list-widget";
import { UpcomingEventsWidget } from "@/components/dashboard/upcoming-events-widget";
import { Lock } from "lucide-react";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense>
    <div className="flex-1 space-y-6">
      <div className="flex justify-between items-start">
        <PageHeader 
          title="Dashboard" 
          description="Here's a snapshot of your study world. Nurture your goals and watch your knowledge grow." 
        />
        <Button variant="outline">
            <Lock className="mr-2 h-4 w-4" />
            Unlock Widgets
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <QuickNotesWidget />
        <TodaysTasksWidget />
        <UpcomingEventsWidget />
        <StudyStatisticsWidget />
        <StudyTimerWidget />
        <QuickLinksWidget />
      </div>

      <div className="flex justify-center mt-6">
        <Button variant="outline" className="bg-background">
          + Add Widget
        </Button>
      </div>
    </div>
    </Suspense>
  );
}
