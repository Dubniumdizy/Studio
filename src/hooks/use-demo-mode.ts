import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { DEMO_CONFIG, isDemoMode } from '@/lib/demo-mode';

export function useDemoMode() {
  const [isDemo, setIsDemo] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsDemo(isDemoMode());
  }, []);

  // Auto-navigation through pages
  useEffect(() => {
    if (!isDemo) return;

    const timeout = setTimeout(() => {
      const nextIndex = (currentPageIndex + 1) % DEMO_CONFIG.navigationFlow.length;
      const nextPath = DEMO_CONFIG.navigationFlow[nextIndex];
      
      setCurrentPageIndex(nextIndex);
      router.push(nextPath);
    }, DEMO_CONFIG.timings.pageView);

    return () => clearTimeout(timeout);
  }, [isDemo, currentPageIndex, router]);

  // Auto-scroll effect
  useEffect(() => {
    if (!isDemo) return;

    let scrollDirection = 1; // 1 for down, -1 for up
    let scrollPosition = 0;

    const scrollInterval = setInterval(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      
      if (maxScroll <= 0) return;

      scrollPosition += scrollDirection * 200;

      // Reverse direction at boundaries
      if (scrollPosition >= maxScroll) {
        scrollDirection = -1;
        scrollPosition = maxScroll;
      } else if (scrollPosition <= 0) {
        scrollDirection = 1;
        scrollPosition = 0;
      }

      window.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }, DEMO_CONFIG.timings.scrollInterval);

    return () => clearInterval(scrollInterval);
  }, [isDemo, pathname]);

  return { isDemo, setIsDemo };
}

// Hook for automated widget interactions
export function useDemoWidgetInteractions(isDemo: boolean) {
  const [activeWidget, setActiveWidget] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemo) return;

    const widgets = document.querySelectorAll('[data-widget-id]');
    if (widgets.length === 0) return;

    let currentIndex = 0;

    const interval = setInterval(() => {
      const widget = widgets[currentIndex] as HTMLElement;
      if (widget) {
        setActiveWidget(widget.dataset.widgetId || null);
        
        // Simulate hover effect
        widget.style.transform = 'scale(1.02)';
        widget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
        
        setTimeout(() => {
          widget.style.transform = '';
          widget.style.boxShadow = '';
        }, DEMO_CONFIG.timings.widgetInteraction - 500);
      }

      currentIndex = (currentIndex + 1) % widgets.length;
    }, DEMO_CONFIG.timings.widgetInteraction);

    return () => clearInterval(interval);
  }, [isDemo]);

  return { activeWidget };
}
