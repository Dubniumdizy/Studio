import React, { useMemo } from "react";
import { CalendarEvent } from "../../types/calendar";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const MonthView = ({
  currentDate,
  events,
  onDateClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
}) => {
  const monthStart = startOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(endOfMonth(monthStart));

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col flex-grow bg-card rounded-lg border overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-grow overflow-auto">
        {days.map((day, dayIdx) => {
          const dayEvents = events.filter(
            (e) => e.dueDate && isSameDay(parseISO(e.dueDate), day)
          );
          return (
            <div
              key={day.toString()}
              className={cn(
                "p-2 border-b flex flex-col cursor-pointer hover:bg-muted/80",
                {
                  "bg-muted/50": !isSameMonth(day, monthStart),
                  relative: isToday(day),
                  "border-r": dayIdx % 7 !== 6,
                }
              )}
              onClick={() => onDateClick(day)}
            >
              {isToday(day) && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
              <span
                className={cn("font-medium self-end", {
                  "text-muted-foreground": !isSameMonth(day, monthStart),
                  "text-primary font-bold": isToday(day),
                })}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 flex-grow overflow-y-auto space-y-1 text-xs">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="p-1 rounded bg-accent/80 text-accent-foreground truncate"
                  >
                    {event.text}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    + {dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { MonthView };