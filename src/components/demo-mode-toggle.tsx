'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Square, Settings } from 'lucide-react';
import { isDemoMode, enableDemoMode, disableDemoMode } from '@/lib/demo-mode';
import { cn } from '@/lib/utils';

export function DemoModeToggle() {
  const [isDemo, setIsDemo] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsDemo(isDemoMode());
  }, []);

  const handleToggle = () => {
    if (isDemo) {
      disableDemoMode();
    } else {
      enableDemoMode();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isDemo && (
        <div className="mb-2 px-4 py-2 bg-green-500 text-white rounded-full shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">Demo Mode Active</span>
          </div>
        </div>
      )}
      
      <Card className={cn(
        "transition-all duration-300 shadow-xl",
        isExpanded ? "p-4 w-64" : "p-2"
      )}>
        {isExpanded ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Demo Mode</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {isDemo 
                ? "The app is running in continuous demo mode. It will automatically navigate through pages and interact with widgets."
                : "Enable demo mode to run the app as a continuous demonstration."
              }
            </p>
            
            <Button
              onClick={handleToggle}
              className="w-full"
              variant={isDemo ? "destructive" : "default"}
            >
              {isDemo ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Demo
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Demo
                </>
              )}
            </Button>
            
            {!isDemo && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Demo features:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Auto-login</li>
                  <li>Automatic page navigation</li>
                  <li>Widget interactions</li>
                  <li>Smooth scrolling</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={() => setIsExpanded(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Demo
          </Button>
        )}
      </Card>
    </div>
  );
}
