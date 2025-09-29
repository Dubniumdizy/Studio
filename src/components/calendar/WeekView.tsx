import React, { useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeIndicator, HOUR_HEIGHT } from "./TimeComponents";
import { processOverlappingEvents, getEventStyles } from "@/lib/calendarUtils";
import { hasDeadlineTag } from "@/lib/calendar-bridge";
import type { EnhancedCalendarEvent } from "@/types/enhanced-calendar";

interface WeekViewProps {
  currentDate: Date;
  events: EnhancedCalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: EnhancedCalendarEvent) => void;
  onCreateEvent: (date: Date, time: string) => void;
}

const headerHeight = 74;

export const WeekView: React.FC<WeekViewProps> = ({ currentDate, events, onDateClick, onEventClick, onCreateEvent }) => {
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, dayIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const hour = Math.floor(offsetY / HOUR_HEIGHT);
    const minutes = Math.floor(((offsetY % HOUR_HEIGHT) / HOUR_HEIGHT) * 4) * 15;
    const time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const date = addDays(weekStart, dayIndex);
    onCreateEvent(date, time);
  };

  // Process events for each day
  const processedEventsByDay = useMemo(() => {
    const result: { [key: string]: EnhancedCalendarEvent[] } = {};
    days.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEvents = events.filter(event => format(event.start, 'yyyy-MM-dd') === dayStr);
      result[dayStr] = processOverlappingEvents(dayEvents);
    });
    return result;
  }, [days, events]);

  return (
    <div className="bg-card rounded-lg border" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="overflow-y-auto" style={{ height: '100%' }}>
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Headers */}
          <div className="sticky top-0 bg-background z-10 text-center py-2 border-b" style={{ height: `${headerHeight}px` }}>
            <p className="text-sm text-muted-foreground">Time</p>
          </div>
          {days.map(day => (
            <div
              key={day.toString()}
              className="sticky top-0 bg-background z-10 text-center py-2 border-b cursor-pointer hover:bg-muted/50"
              style={{ height: `${headerHeight}px` }}
              onClick={() => onDateClick(day)}
            >
              <p className="text-sm text-muted-foreground">{format(day, 'EEE')}</p>
              <p className={cn("text-2xl font-bold", { "text-primary": isToday(day) })}>{format(day, 'd')}</p>
            </div>
          ))}

          {/* Time grid */}
          <div className="relative" style={{ minHeight: `${24 * HOUR_HEIGHT}px` }}>
            {hours.map(hour => (
              <div
                key={hour}
                className="border-r border-b border-dashed text-xs text-muted-foreground flex items-center justify-center"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, '0') + ':00'}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayEvents = processedEventsByDay[dayStr] || [];
            
            return (
              <div
                key={day.toString()}
                className="relative"
                style={{ minHeight: `${24 * HOUR_HEIGHT}px` }}
                onClick={e => handleGridClick(e, dayIndex)}
              >
                {/* Hour grid lines */}
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="border-b border-dashed"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map(event => {
                  const style = getEventStyles(event);
                  const isDeadline = hasDeadlineTag(event.tags || []) || (event.tags || []).includes('theme:black');
                  const colorClasses = isDeadline
                    ? 'border-black bg-black text-white'
                    : (
                        event.energyLevel === 1 ? 'border-red-500 bg-red-50' :
                        event.energyLevel === 2 ? 'border-orange-500 bg-orange-50' :
                        event.energyLevel === 3 ? 'border-yellow-500 bg-yellow-50' :
                        event.energyLevel === 4 ? 'border-green-500 bg-green-50' :
                        event.energyLevel === 5 ? 'border-blue-500 bg-blue-50' :
                        'border-gray-500 bg-gray-50'
                      );
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "absolute p-2 rounded-md border-l-4 text-sm backdrop-blur-sm shadow-sm flex flex-col justify-start overflow-hidden cursor-pointer pointer-events-auto",
                        colorClasses
                      )}
                      style={style}
                      onClick={e => { e.stopPropagation(); onEventClick(event); }}
                    >
                      <div className={cn("font-semibold truncate", isDeadline ? "text-white" : "text-gray-800")}>{event.title}</div>
                      <div className={cn("text-xs truncate", isDeadline ? "text-white/80" : "text-muted-foreground")}>
                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                      </div>
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday(day) && (
                  <div className="absolute inset-x-0 z-20 pointer-events-none">
                    <TimeIndicator />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
