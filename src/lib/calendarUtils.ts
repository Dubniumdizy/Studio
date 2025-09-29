import { type Goal } from "@/lib/goals-data";
import { type CalendarEvent } from "@/types/calendar";
import {
    addDays,
    addMonths,
    addWeeks,
    addYears,
    eachDayOfInterval,
    endOfDay,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    parseISO,
    startOfMonth,
    startOfWeek,
    subMonths,
    subWeeks,
    getDay,
    isBefore,
    subDays,
    differenceInWeeks as dateFnsDifferenceInWeeks,
} from "date-fns";
import type React from "react";
import { type EnhancedCalendarEvent } from '@/types/enhanced-calendar';

export const HOUR_HEIGHT = 40; // height of one hour in pixels

export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export const timeToPosition = (time: string): number => {
    return (timeToMinutes(time) / 60) * HOUR_HEIGHT;
};

// We need to type the event for this function correctly, adding start/end
type ProcessableEvent = CalendarEvent & { start: number; end: number };

export const processOverlappingEvents = (events: EnhancedCalendarEvent[]): EnhancedCalendarEvent[] => {
    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    
    // Group overlapping events
    const groups: EnhancedCalendarEvent[][] = [];
    let currentGroup: EnhancedCalendarEvent[] = [];
    
    sortedEvents.forEach(event => {
        if (currentGroup.length === 0) {
            currentGroup = [event];
        } else {
            const lastEvent = currentGroup[currentGroup.length - 1];
            if (event.start < lastEvent.end) {
                // Events overlap
                currentGroup.push(event);
            } else {
                // No overlap, start new group
                groups.push(currentGroup);
                currentGroup = [event];
            }
        }
    });
    
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    
    // Calculate layout for each group
    const processedEvents: EnhancedCalendarEvent[] = [];
    groups.forEach(group => {
        group.forEach((event, index) => {
            const totalCols = group.length;
            const col = index;
            const width = (100 / totalCols) - 1;
            const left = (col * width);
            
            processedEvents.push({
                ...event,
                layout: {
                    left,
                    width,
                    col,
                    totalCols
                }
            });
        });
    });
    
    return processedEvents;
};

export const getEventStyles = (event: EnhancedCalendarEvent): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${timeToPosition(formatTime(event.start, 'HH:mm'))}px`,
        height: `${Math.max((event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60) * HOUR_HEIGHT, 30)}px`,
        zIndex: event.importance || 1
    };
    
    if (event.layout) {
        baseStyle.left = `${event.layout.left}%`;
        baseStyle.width = `${event.layout.width}%`;
    } else {
        baseStyle.left = '4px';
        baseStyle.right = '4px';
    }
    
    return baseStyle;
};

export const formatTime = (date: Date, formatString: string): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (formatString === 'HH:mm') {
        return `${hours}:${minutes}`;
    }
    
    return date.toLocaleString();
};

export const expandRecurringEvents = (goals: (Goal & { subjectName: string })[], viewStart: Date, viewEnd: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const dayMap: { [key: string]: number } = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

    const adjustedViewEnd = endOfDay(viewEnd);

    for (const goal of goals) {
        if (!goal.dueDate) continue;

        const goalStartDate = parseISO(goal.dueDate);
        if (isNaN(goalStartDate.getTime())) continue;

        if (!goal.recurrence) {
            // It's a single, non-recurring event
            if (goalStartDate >= viewStart && goalStartDate <= adjustedViewEnd) {
                events.push({ ...goal, instanceDate: goal.dueDate });
            }
        } else {
            // It's a recurring event
            const recurrence = goal.recurrence;
            let loopEndDate = recurrence.until ? parseISO(recurrence.until) : adjustedViewEnd;
            if (isNaN(loopEndDate.getTime())) {
                loopEndDate = adjustedViewEnd;
            }

            const finalEndDate = loopEndDate < adjustedViewEnd ? loopEndDate : adjustedViewEnd;
            
            // Start iterating from the later of the view start or goal start
            let currentDate = new Date(viewStart);
            if(goalStartDate > currentDate) {
                currentDate = new Date(goalStartDate);
            }
            
            const exceptions = new Set(goal.recurrenceExceptions || []);

            while (currentDate <= finalEndDate) {
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                if (exceptions.has(currentDateStr)) {
                    currentDate = addDays(currentDate, 1);
                    continue;
                }

                let shouldAdd = false;

                switch (recurrence.frequency) {
                    case 'daily':
                        shouldAdd = true;
                        break;
                    case 'weekly':
                        if (recurrence.byday && recurrence.byday.length > 0) {
                            shouldAdd = recurrence.byday.some(d => dayMap[d] === getDay(currentDate));
                        } else {
                            shouldAdd = getDay(currentDate) === getDay(goalStartDate);
                        }
                        break;
                    case 'bi-weekly':
                        const weekDiff = dateFnsDifferenceInWeeks(currentDate, goalStartDate);
                         if (weekDiff >= 0 && weekDiff % 2 === 0) {
                             if (recurrence.byday && recurrence.byday.length > 0) {
                                shouldAdd = recurrence.byday.some(d => dayMap[d] === getDay(currentDate));
                            } else {
                                shouldAdd = getDay(currentDate) === getDay(goalStartDate);
                            }
                        }
                        break;
                    case 'monthly':
                        shouldAdd = currentDate.getDate() === goalStartDate.getDate();
                        break;
                    case 'yearly':
                        shouldAdd = (currentDate.getDate() === goalStartDate.getDate() && currentDate.getMonth() === goalStartDate.getMonth());
                        break;
                }

                if (shouldAdd) {
                    events.push({
                        ...goal,
                        id: `${goal.id}-${currentDateStr}`,
                        dueDate: currentDateStr,
                        instanceDate: currentDateStr,
                        recurrenceId: goal.id,
                    });
                }

                currentDate = addDays(currentDate, 1);
            }
        }
    }
    return events;
};
