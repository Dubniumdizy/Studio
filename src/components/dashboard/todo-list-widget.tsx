"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckSquare, Plus } from "lucide-react"

const tasks = [
  { id: "1", label: "Review Linear Algebra notes", checked: false },
  { id: "2", label: "Complete Physics problem set", checked: true },
  { id: "3", label: "Study for Chemistry exam", checked: false },
];

export function TodaysTasksWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="w-5 h-5" />
          Today's Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center space-x-3">
              <Checkbox id={task.id} defaultChecked={task.checked} />
              <label
                htmlFor={task.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-data-[state=checked]:line-through peer-data-[state=checked]:text-muted-foreground"
              >
                {task.label}
              </label>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Plus className="mr-2 h-4 w-4" />
            Add task
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Re-export with the name used by WidgetGrid
export { TodaysTasksWidget as TodoListWidget }
