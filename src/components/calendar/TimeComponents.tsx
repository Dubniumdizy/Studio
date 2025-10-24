"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { HOUR_HEIGHT as LIB_HOUR_HEIGHT } from '@/lib/calendarUtils';

interface TimeGutterProps {
    headerHeight?: number;
    minHour?: number; // inclusive, default 0
    maxHour?: number; // inclusive, default 23
}

export const HOUR_HEIGHT = LIB_HOUR_HEIGHT;

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);

const TimeGutterImpl: React.FC<TimeGutterProps> = ({ headerHeight = 60, minHour = 0, maxHour = 23 }) => {
    const hours = useMemo(() => {
        const start = Math.max(0, Math.min(23, minHour));
        const end = Math.max(start, Math.min(23, maxHour));
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [minHour, maxHour]);

    return (
        <div className="w-16 border-r bg-muted/30 flex-shrink-0 sticky left-0 z-20">
            <div 
                className="sticky top-0 bg-background z-30 text-center py-2 border-b text-sm font-medium text-muted-foreground"
                style={{ height: `${headerHeight}px` }}
            >
                Time
            </div>
            <div className="relative">
                {hours.map(hour => (
                    <div 
                        key={hour} 
                        className="border-b border-dashed text-xs text-muted-foreground px-1 py-1 bg-background"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                        {String(hour).padStart(2, '0') + ':00'}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const TimeGutter = React.memo(TimeGutterImpl);

interface TimeIndicatorProps { minHour?: number; maxHour?: number }

const TimeIndicatorImpl: React.FC<TimeIndicatorProps> = ({ minHour = 0, maxHour = 23 }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        let timer: number | undefined;

        const scheduleNextTick = () => {
            const n = new Date();
            const msToNextMinute = (60 - n.getSeconds()) * 1000 - n.getMilliseconds();
            timer = window.setTimeout(() => {
                setNow(new Date());
                scheduleNextTick();
            }, Math.max(msToNextMinute, 1000));
        };

        const onVisibilityChange = () => {
            if (document.hidden) {
                if (timer) window.clearTimeout(timer);
                timer = undefined;
            } else {
                // Update immediately on resume and reschedule
                setNow(new Date());
                scheduleNextTick();
            }
        };

        scheduleNextTick();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            if (timer) window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const topPositionAbsolute = (currentHour * HOUR_HEIGHT) + (currentMinute / 60 * HOUR_HEIGHT);
    const offset = (minHour) * HOUR_HEIGHT;
    const visibleTop = topPositionAbsolute - offset;
    const visibleHeight = (maxHour - minHour + 1) * HOUR_HEIGHT;

    if (visibleTop < 0 || visibleTop > visibleHeight) {
        return null;
    }

    return (
        <div 
            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
            style={{ top: `${visibleTop}px` }}
        >
            <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
            <div className="flex-1 h-[2px] bg-red-500" />
            <div className="w-2 h-2 bg-red-500 rounded-full -mr-1" />
        </div>
    );
};

export const TimeIndicator = React.memo(TimeIndicatorImpl);
