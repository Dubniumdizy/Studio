import React, { useMemo } from "react";
import {
    addDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { type EnhancedCalendarEvent } from "@/types/enhanced-calendar";
import { TimeIndicator, TimeGutter } from "./TimeComponents";
import { HOUR_HEIGHT } from "@/lib/calendarUtils";
import { hasDeadlineTag } from "@/lib/calendar-bridge";

// Reuse constants/functions to avoid per-render allocations
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const ENERGY_COLOR_MAP: Record<number, string> = {
    1: 'border-red-500 bg-red-50',
    2: 'border-orange-500 bg-orange-50',
    3: 'border-yellow-500 bg-yellow-50',
    4: 'border-green-500 bg-green-50',
    5: 'border-blue-500 bg-blue-50'
};

const getEnergyColor = (energyLevel?: number) => ENERGY_COLOR_MAP[energyLevel as number] || 'border-gray-500 bg-gray-50';

// Compute side-by-side layout for overlapping events.
// For each group of overlapping intervals in a day, we assign a column index to
// every event so that concurrently active events are displayed side-by-side.
// Width per event is 100% / number_of_columns in its overlap group.
function computeEventColumns(dayEvents: EnhancedCalendarEvent[]): Record<string, { col: number; colCount: number }> {
  // Sort by start time ascending, and for equal starts put longer first
  const events = [...dayEvents].sort((a, b) => {
    const ta = a.start.getTime();
    const tb = b.start.getTime();
    if (ta !== tb) return ta - tb;
    return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
  })

  const result: Record<string, { col: number; colCount: number }> = {}
  const overlaps = (a: EnhancedCalendarEvent, b: EnhancedCalendarEvent) => a.start < b.end && b.start < a.end

  // Build clusters of overlapping events (interval graph components)
  let cluster: EnhancedCalendarEvent[] = []
  let clusterEnd = -Infinity
  const flushCluster = () => {
    if (cluster.length === 0) return
    // Assign columns greedily (interval partitioning)
    const colEndTimes: number[] = []
    const cols: number[] = new Array(cluster.length).fill(0)
    for (let i = 0; i < cluster.length; i++) {
      const e = cluster[i]
      const start = e.start.getTime()
      let placed = false
      for (let c = 0; c < colEndTimes.length; c++) {
        if (start >= colEndTimes[c]) {
          cols[i] = c
          colEndTimes[c] = e.end.getTime()
          placed = true
          break
        }
      }
      if (!placed) {
        cols[i] = colEndTimes.length
        colEndTimes.push(e.end.getTime())
      }
    }
    const colCount = colEndTimes.length
    for (let i = 0; i < cluster.length; i++) {
      result[cluster[i].id] = { col: cols[i], colCount }
    }
    cluster = []
    clusterEnd = -Infinity
  }

  for (const ev of events) {
    if (cluster.length === 0) {
      cluster.push(ev)
      clusterEnd = ev.end.getTime()
    } else {
      // If this event overlaps any in the current cluster (i.e., starts before clusterEnd), extend cluster
      if (ev.start.getTime() < clusterEnd) {
        cluster.push(ev)
        if (ev.end.getTime() > clusterEnd) clusterEnd = ev.end.getTime()
      } else {
        // No overlap with current cluster; flush and start a new one
        flushCluster()
        cluster.push(ev)
        clusterEnd = ev.end.getTime()
      }
    }
  }
  flushCluster()
  return result
}

 type View = 'day' | 'week' | 'month';

interface MonthViewProps {
    currentDate: Date;
    events: EnhancedCalendarEvent[];
    onDateClick: (date: Date) => void;
}

const MonthViewImpl: React.FC<MonthViewProps> = ({ currentDate, events, onDateClick }) => {
    const monthStart = startOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // Group events by day to avoid filtering for every cell on each render
    const eventsByDay = useMemo(() => {
        const map = new Map<string, EnhancedCalendarEvent[]>();
        for (const e of events) {
            const key = format(e.start, 'yyyy-MM-dd');
            const bucket = map.get(key);
            if (bucket) bucket.push(e); else map.set(key, [e]);
        }
        return map;
    }, [events]);

    return (
        <div className="flex flex-col flex-grow bg-card rounded-lg border">
            <div className="grid grid-cols-7 border-b">
                {weekDays.map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-grow">
                {days.map((day, dayIdx) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDay.get(key) || [];
                    return (
                        <div
                            key={day.getTime()}
                            className={cn("p-2 border-b flex flex-col cursor-pointer hover:bg-muted/80", {
                                "bg-muted/50": !isSameMonth(day, monthStart),
                                "relative": isToday(day),
                                "border-r": dayIdx % 7 !== 6,
                            })}
                            onClick={() => onDateClick(day)}
                        >
                            {isToday(day) && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />}
                            <span className={cn("font-medium self-end", {
                                "text-muted-foreground": !isSameMonth(day, monthStart),
                                "text-primary font-bold": isToday(day)
                            })}>
                                {format(day, 'd')}
                            </span>
                            <div className="mt-1 flex-grow overflow-y-auto space-y-1 text-xs">
{dayEvents.slice(0, 3).map(event => {
                                    const isDeadline = hasDeadlineTag(event.tags || []) || (event.tags || []).includes('theme:black');
                                    return (
                                        <div key={event.id} className={cn("p-1 rounded truncate", isDeadline ? "bg-black text-white" : "bg-accent/80 text-accent-foreground") }>
                                            {event.title}
                                        </div>
                                    )
                                })}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs text-muted-foreground text-center">
                                        + {dayEvents.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
};

export const MonthView = React.memo(MonthViewImpl);

interface WeekViewProps {
    currentDate: Date;
    events: EnhancedCalendarEvent[];
    onDateClick: (date: Date) => void;
    onEventClick: (event: EnhancedCalendarEvent) => void;
    onCreateEvent: (date: Date, time: string) => void;
}

const WeekViewImpl: React.FC<WeekViewProps> = ({ currentDate, events, onDateClick, onEventClick, onCreateEvent }) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
    const headerHeight = 74;

    const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, dayIndex: number) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const hour = Math.floor(offsetY / HOUR_HEIGHT);
        const minutes = Math.floor(((offsetY % HOUR_HEIGHT) / HOUR_HEIGHT) * 4) * 15; // Snap to 15 mins
        const time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const date = addDays(weekStart, dayIndex);
        onCreateEvent(date, time);
    };

    const processedEventsByDay = useMemo(() => {
        // Build a map of all events by date once (O(N)) and reuse per day lookup (O(1))
        const map = new Map<string, EnhancedCalendarEvent[]>();
        for (const e of events) {
            const key = format(e.start, 'yyyy-MM-dd');
            const arr = map.get(key);
            if (arr) arr.push(e); else map.set(key, [e]);
        }
        const result: { [key: string]: EnhancedCalendarEvent[] } = {};
        for (const day of days) {
            const key = format(day, 'yyyy-MM-dd');
            result[key] = map.get(key) || [];
        }
        return result;
    }, [days, events]);

    return (
        <div className="flex-grow overflow-auto bg-card rounded-lg border flex">
            <TimeGutter headerHeight={headerHeight} />

            <div className="flex-grow grid grid-cols-7 relative">
                {days.map((day, dayIndex) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayEvents = processedEventsByDay[dayStr] || [];

                    return (
                        <div key={day.getTime()} className={cn("border-r", { "border-r-0": dayIndex === 6 })}>
                            <div className="sticky top-0 bg-background z-10 text-center py-2 border-b cursor-pointer hover:bg-muted/50" style={{ height: `${headerHeight}px` }} onClick={() => onDateClick(day)}>
                                <p className="text-sm text-muted-foreground">{format(day, 'EEE')}</p>
                                <p className={cn("text-2xl font-bold", { "text-primary": isToday(day) })}>{format(day, 'd')}</p>
                            </div>
                            <div className="relative h-full" onClick={(e) => handleGridClick(e, dayIndex)}>
                                {HOURS_24.map(hour => (
                                    <div key={`${day.getTime()}-${hour}`} className="border-b border-dashed cursor-pointer" style={{ height: `${HOUR_HEIGHT}px` }} />
                                ))}
                                <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
{(() => {
                                        const layout = computeEventColumns(dayEvents)
                                        return dayEvents.map(event => {
                                          const isDeadline = hasDeadlineTag(event.tags || []) || (event.tags || []).includes('theme:black');
                                          const colorClasses = isDeadline ? 'border-black bg-black text-white' : getEnergyColor(event.energyLevel);
                                          const startHour = event.start.getHours();
                                          const startMinute = event.start.getMinutes();
                                          const topPosition = (startHour * HOUR_HEIGHT) + (startMinute / 60 * HOUR_HEIGHT);
                                          const durationHours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
                                          const height = Math.max(durationHours * HOUR_HEIGHT, 30);
                                          const colInfo = layout[event.id] || { col: 0, colCount: 1 }
                                          const leftPercent = (colInfo.col * 100) / Math.max(colInfo.colCount, 1)
                                          const widthPercent = 100 / Math.max(colInfo.colCount, 1)
                                          const gapPx = 4 // horizontal gutter among overlapping events

                                          return (
                                            <div
                                              key={event.id}
                                              className={cn(
                                                "absolute p-1 rounded-md border-l-4 text-xs backdrop-blur-sm shadow-sm flex flex-col justify-start overflow-hidden cursor-pointer pointer-events-auto",
                                                colorClasses
                                              )}
                                              style={{
                                                top: `${topPosition}px`,
                                                height: `${height}px`,
                                                left: `calc(${leftPercent}% + 2px)`,
                                                width: `calc(${widthPercent}% - ${gapPx}px)`,
                                                zIndex: event.importance || 1
                                              }}
                                              onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                            >
                                              {event.importance && (
                                                <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-700 border">
                                                  {event.importance}
                                                </div>
                                              )}
                                              
                                              <div className="flex flex-col gap-1">
                                                <div className="flex-1 min-w-0">
                                                  <p className={cn("font-semibold leading-tight truncate", isDeadline ? "text-white" : "text-gray-800") }>
                                                    {event.title}
                                                  </p>
                                                  <p className={cn("text-xs", isDeadline ? "text-white/80" : "text-gray-600")}> {format(event.start, "HH:mm")} - {format(event.end, "HH:mm")} </p>
                                                </div>
                                                {event.pictures && event.pictures.length > 0 && (
                                                  <div className="w-24 h-14 rounded overflow-hidden flex-shrink-0" style={{ aspectRatio: '16/9', minHeight: '60px' }}>
                                                    <img
                                                      src={event.pictures[0]}
                                                      alt={event.title}
                                                      className="w-full h-full object-cover"
                                                      loading="lazy"
                                                      decoding="async"
                                                      fetchPriority="low"
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )
                                        })
                                      })()}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {days.some(day => isToday(day)) && (
                    <div className="absolute left-0 right-0 h-full z-10 pointer-events-none" style={{ marginTop: `${headerHeight}px` }}>
                        <TimeIndicator />
                    </div>
                )}
            </div>
        </div>
    )
};

export const WeekView = React.memo(WeekViewImpl);

interface DayViewProps {
    currentDate: Date;
    events: EnhancedCalendarEvent[];
    onEventClick: (event: EnhancedCalendarEvent) => void;
    onCreateEvent: (date: Date, time: string) => void;
}

const DayViewImpl: React.FC<DayViewProps> = ({ currentDate, events, onEventClick, onCreateEvent }) => {
    const headerHeight = 74; // Match WeekView

    // Get events for this day, including cross-day events
    const dayEvents = useMemo(() => {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        return events.filter(event => event.start <= dayEnd && event.end >= dayStart);
    }, [events, currentDate]);

    const getEventPosition = (event: EnhancedCalendarEvent) => {
        const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
        const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
        const duration = Math.max(endMinutes - startMinutes, 15); // ensure minimum height maps to >= 15 mins
        const top = (startMinutes / 60) * HOUR_HEIGHT;
        const height = (duration / 60) * HOUR_HEIGHT;
        return { top, height };
    };

    return (
        <div className="bg-card rounded-lg border" style={{ height: 'calc(100vh - 120px)' }}>
            <div className="overflow-y-auto" style={{ height: '100%' }}>
                <div className="grid grid-cols-[60px_1fr]">
                    {/* TimeGutter header */}
                    <div className="sticky top-0 bg-background z-10 text-center py-2 border-b" style={{ height: `${headerHeight}px` }}>
                        <p className="text-sm text-muted-foreground">Time</p>
                    </div>
                    {/* Day header */}
                    <div className="sticky top-0 bg-background z-10 text-center py-2 border-b cursor-pointer hover:bg-muted/50" style={{ height: `${headerHeight}px` }}>
                        <p className="text-sm text-muted-foreground">{format(currentDate, 'EEE')}</p>
                        <p className={cn("text-2xl font-bold", { "text-primary": isToday(currentDate) })}>{format(currentDate, 'd')}</p>
                    </div>

                    {/* TimeGutter hours */}
                    <div className="relative">
                        {HOURS_24.map(hour => (
                            <div
                                key={hour}
                                className="border-r border-b border-dashed text-xs text-muted-foreground flex items-center justify-center"
                                style={{ height: HOUR_HEIGHT }}
                            >
                                {String(hour).padStart(2, '0') + ':00'}
                            </div>
                        ))}
                    </div>

                    {/* Day column */}
                    <div
                        className="relative"
                        style={{ height: `${24 * HOUR_HEIGHT}px` }}
                        onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const offsetY = e.clientY - rect.top;
                            const hour = Math.floor(offsetY / HOUR_HEIGHT);
                            const minutes = Math.floor(((offsetY % HOUR_HEIGHT) / HOUR_HEIGHT) * 4) * 15;
                            const date = new Date(currentDate);
                            date.setHours(hour, minutes, 0, 0);
                            onCreateEvent(date, `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
                        }}
                    >
                        {/* Hour grid lines */}
                        {HOURS_24.map(hour => (
                            <div
                                key={hour}
                                className="border-b border-dashed"
                                style={{ height: HOUR_HEIGHT }}
                            />
                        ))}

                        {/* Events */}
{(() => {
                            const layout = computeEventColumns(dayEvents)
                            return dayEvents.map(event => {
                              const { top, height } = getEventPosition(event);
                              const isDeadline = hasDeadlineTag(event.tags || []) || (event.tags || []).includes('theme:black');
                              const colorClasses = isDeadline ? 'border-black bg-black text-white' : getEnergyColor(event.energyLevel);
                              const colInfo = layout[event.id] || { col: 0, colCount: 1 }
                              const leftPercent = (colInfo.col * 100) / Math.max(colInfo.colCount, 1)
                              const widthPercent = 100 / Math.max(colInfo.colCount, 1)
                              const gapPx = 4
                              return (
                                <div
                                  key={event.id}
                                  className={cn(
                                    "absolute p-2 rounded-md border-l-4 text-xs backdrop-blur-sm shadow-sm flex flex-col justify-start overflow-hidden cursor-pointer",
                                    colorClasses
                                  )}
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: `calc(${leftPercent}% + 2px)`,
                                    width: `calc(${widthPercent}% - ${gapPx}px)`,
                                    zIndex: event.importance || 1
                                  }}
                                  onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                >
                                  {event.importance && (
                                    <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-700 border">
                                      {event.importance}
                                    </div>
                                  )}
                                  
                                  <div className="relative z-10">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex-1 min-w-0">
                                        <p className={cn("font-semibold leading-tight truncate", isDeadline ? "text-white" : "text-gray-800")}>{event.title}</p>
                                        {height > 40 && event.description && (
                                          <p className={cn("text-xs truncate mt-1", isDeadline ? "text-white/80" : "text-gray-600")}>{event.description}</p>
                                        )}
                                      </div>
                                      {event.pictures && event.pictures.length > 0 && (
                                        <div className="w-24 h-14 rounded overflow-hidden flex-shrink-0" style={{ aspectRatio: '16/9', minHeight: '60px' }}>
                                          <img src={event.pictures[0]} alt={event.title} className="w-full h-full object-cover" loading="lazy" decoding="async" fetchPriority="low" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          })()}

                        {/* Current time indicator */}
                        {isToday(currentDate) && (
                            <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ height: `${24 * HOUR_HEIGHT}px`, top: 0 }}>
                                <TimeIndicator />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DayView = React.memo(DayViewImpl);
