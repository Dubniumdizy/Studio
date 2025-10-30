# Demo Mode Instructions

Your Studyverse Garden app now has a fully functional demo mode that allows it to run continuously as an automated demonstration!

## How to Enable Demo Mode

### Method 1: Using the UI Toggle
1. Start your app: `npm run dev`
2. Look for the **"Demo"** button in the bottom-right corner of the screen
3. Click it to expand the demo mode controls
4. Click **"Start Demo"** to activate demo mode
5. The app will reload and begin running automatically

### Method 2: Direct Configuration
1. Open your browser's developer console
2. Run: `localStorage.setItem('demoMode', 'true')`
3. Reload the page

## What Demo Mode Does

When demo mode is active, the app will:

✅ **Auto-login** - Automatically logs in using demo credentials after a short delay
✅ **Auto-navigate** - Cycles through all pages in a loop:
   - Dashboard
   - Calendar
   - Goals
   - Focus (Study Timer)
   - Analytics
   - Flashcards
   - Formula Sheet
   - Inspiration
   - Bank (Resources)
   - Notes
   
✅ **Widget interactions** - Highlights and interacts with widgets on the dashboard
✅ **Auto-scroll** - Smoothly scrolls up and down each page to showcase content
✅ **Visual indicator** - Shows a green "Demo Mode Active" badge

## Customization

You can customize demo behavior by editing `src/lib/demo-mode.ts`:

```typescript
timings: {
  pageView: 8000,          // Time spent on each page (ms)
  widgetInteraction: 3000, // Time between widget highlights (ms)
  scrollInterval: 2000,    // Smooth scroll interval (ms)
  loginDelay: 2000,        // Delay before auto-login (ms)
  navigationDelay: 1000    // Delay before navigation (ms)
}
```

## How to Stop Demo Mode

### Method 1: Using the UI Toggle
1. Click the green "Demo Mode Active" indicator or the "Demo" button
2. Click **"Stop Demo"**
3. The app will reload in normal mode

### Method 2: Direct Configuration
1. Open your browser's developer console
2. Run: `localStorage.setItem('demoMode', 'false')`
3. Reload the page

## Demo Credentials

The demo mode uses these credentials for auto-login:
- **Email**: demo@studyverse.app
- **Password**: demo123

Make sure your authentication system supports these credentials for demo purposes.

## Technical Details

The demo mode implementation includes:
- `src/lib/demo-mode.ts` - Configuration and helper functions
- `src/hooks/use-demo-mode.ts` - React hooks for demo functionality
- `src/components/demo-mode-toggle.tsx` - UI controls
- Auto-login integration in `src/app/login/page.tsx`
- Dashboard integration in `src/app/page.tsx`

## Tips for Presentations

- Enable demo mode before connecting to a projector
- The demo will run continuously without any interaction
- Adjust timing values if the demo feels too fast or slow
- The app will loop indefinitely until demo mode is disabled

Enjoy showcasing your Studyverse Garden app! 🌱
