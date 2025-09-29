import React, { useMemo } from "react";
import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { EnhancedCalendarEvent } from "@/types/enhanced-calendar";
import { TimeIndicator, HOUR_HEIGHT } from "./TimeComponents";
import { processOverlappingEvents, getEventStyles } from "@/lib/calendarUtils";
import { hasDeadlineTag } from "@/lib/calendar-bridge";

interface DayViewProps {
    currentDate: Date;
    events: EnhancedCalendarEvent[];
    onEventClick: (event: EnhancedCalendarEvent) => void;
    onCreateEvent: (date: Date, time: string) => void;
}

const headerHeight = 74;
const hours = Array.from({ length: 24 }, (_, i) => i);

export const DayView: React.FC<DayViewProps> = ({ currentDate, events, onEventClick, onCreateEvent }) => {
    const processedEvents = useMemo(() => processOverlappingEvents(events), [events]);
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    const dayEvents = processedEvents.filter(e => format(e.start, 'yyyy-MM-dd') === dayStr);

    const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const hour = Math.floor(offsetY / HOUR_HEIGHT);
        const minutes = Math.floor(((offsetY % HOUR_HEIGHT) / HOUR_HEIGHT) * 4) * 15;
        const date = new Date(currentDate);
        date.setHours(hour, minutes, 0, 0);
        onCreateEvent(date, `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    };

    return (
        <div className="bg-card rounded-lg border" style={{ maxHeight: 'calc(100vh - 120px)', height: 'fit-content' }}>
            <div className="overflow-y-auto" style={{ height: '100%' }}>
                <div className="grid grid-cols-[60px_1fr]">
                    {/* Headers */}
                    <div className="sticky top-0 bg-background z-10 text-center py-2 border-b" style={{ height: `${headerHeight}px` }}>
                        <p className="text-sm text-muted-foreground">Time</p>
                    </div>
                    <div className="sticky top-0 bg-background z-10 text-center py-2 border-b cursor-pointer hover:bg-muted/50" style={{ height: `${headerHeight}px` }}>
                        <p className="text-sm text-muted-foreground">{format(currentDate, 'EEE')}</p>
                        <p className={cn("text-2xl font-bold", { "text-primary": isToday(currentDate) })}>{format(currentDate, 'd')}</p>
                    </div>

                    {/* Time grid */}
                    <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
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

                    {/* Day column */}
                    <div
                        className="relative"
                        style={{ height: `${24 * HOUR_HEIGHT}px` }}
                        onClick={handleGridClick}
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
                        {isToday(currentDate) && (
                            <div className="absolute inset-x-0 z-20 pointer-events-none">
                                <TimeIndicator />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};