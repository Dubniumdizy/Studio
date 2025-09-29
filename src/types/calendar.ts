import { type Goal } from "@/lib/goals-data";

export type RecurrenceRule = {
    frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';
    until?: string; // ISO date string 'yyyy-MM-dd'
    byday?: ('SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA')[] | undefined;
};

export type GoalFile = {
    id: string;
    name: string;
    type: string;
    url: string;
    content?: string; // Optional, for text-based files like notes
};

export type CalendarEvent = Goal & {
    subjectName: string;
    subjectId?: string;
    layout?: { left: number; width: number; col: number; totalCols: number };
    instanceDate?: string; // For recurring event instances 'yyyy-MM-dd'
    recurrenceId?: string; // ID of the original recurring goal
    // Properties added during processing for Week/Day view layout
    start?: number; // In minutes from midnight
    end?: number; // In minutes from midnight
};
