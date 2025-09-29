import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import Link from "next/link";

export function UpcomingEventsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5" />
          Upcoming Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="font-semibold text-destructive/90">Math Exam</p>
          <p className="text-sm text-destructive/70">Tomorrow, 9:00 AM</p>
        </div>
        <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
          <p className="font-semibold text-primary/90">Study Group</p>
          <p className="text-sm text-primary/70">Friday, 3:00 PM</p>
        </div>
        <Link href="/calendar" className="text-sm text-primary hover:underline pt-2 inline-block">
          View full calendar →
        </Link>
      </CardContent>
    </Card>
  );
}
