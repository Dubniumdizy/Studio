/**
 * Demo Mode Configuration
 * Enables the app to run continuously as an automated demo
 */

export const DEMO_CONFIG = {
  // Enable/disable demo mode
  enabled: typeof window !== 'undefined' && localStorage.getItem('demoMode') === 'true',
  
  // Auto-login credentials
  autoLogin: {
    email: 'demo@studyverse.app',
    password: 'demo123'
  },
  
  // Demo cycle timings (in milliseconds)
  timings: {
    pageView: 8000,          // Time to view each page
    widgetInteraction: 3000, // Time between widget interactions
    scrollInterval: 2000,    // Smooth scroll interval
    loginDelay: 2000,        // Delay before auto-login
    navigationDelay: 1000    // Delay before navigation
  },
  
  // Demo navigation flow
  navigationFlow: [
    '/dashboard',
    '/calendar',
    '/goals',
    '/focus',
    '/analytics',
    '/flashcards',
    '/formula-sheet',
    '/inspiration',
    '/bank',
    '/notes',
    '/dashboard'
  ]
};

export function enableDemoMode() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('demoMode', 'true');
    window.location.reload();
  }
}

export function disableDemoMode() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('demoMode', 'false');
    window.location.reload();
  }
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('demoMode') === 'true';
}
