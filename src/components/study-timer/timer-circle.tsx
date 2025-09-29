
"use client";

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface TimerCircleProps {
  duration: number; // in seconds
  isPaused: boolean;
  onFinish: () => void;
  // If provided, component becomes controlled and uses this time left instead of internal timer
  timeLeftSeconds?: number;
}

export function TimerCircle({ duration, isPaused, onFinish, timeLeftSeconds }: TimerCircleProps) {
  const [internalTimeLeft, setInternalTimeLeft] = useState(duration);
  const timeLeft = typeof timeLeftSeconds === 'number' ? timeLeftSeconds : internalTimeLeft;

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  
  const progress = duration > 0 ? Math.max(0, Math.min(1, timeLeft / duration)) : 0;
  const rawOffset = circumference * (1 - progress);
  const strokeDashoffset = isNaN(rawOffset) ? 0 : rawOffset;

  useEffect(() => {
    if (typeof timeLeftSeconds === 'number') return; // controlled mode
    setInternalTimeLeft(duration);
  }, [duration, timeLeftSeconds]);
  
  useEffect(() => {
    if (typeof timeLeftSeconds === 'number') return; // controlled mode uses parent state
    if (internalTimeLeft <= 0) {
      if (!isPaused) onFinish();
      return;
    }
    if (isPaused) {
      return;
    }

    const intervalId = setInterval(() => {
      setInternalTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPaused, internalTimeLeft, onFinish, timeLeftSeconds]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80">
      <svg className="w-full h-full" viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="hsl(var(--border))"
          strokeWidth="10"
        />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke="hsl(var(--primary))"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn('transition-all duration-1000 ease-linear')}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl md:text-6xl font-bold font-mono tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
