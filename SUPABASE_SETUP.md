# Supabase Setup Guide - Make Your Data Persist!

This guide will help you set up Supabase so all user data (widgets, notes, goals, calendar events, etc.) is saved to the database and persists across sessions.

---

## Step 1: Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. It's **FREE** for personal projects!

---

## Step 2: Create a New Project

1. Click "New Project"
2. Fill in:
   - **Name**: `studyverse-garden` (or your preferred name)
   - **Database Password**: Create a strong password (save it somewhere safe!)
   - **Region**: Choose closest to you
3. Click "Create new project"
4. Wait 2-3 minutes for setup to complete

---

## Step 3: Get Your API Keys

1. In your Supabase project dashboard, click "Settings" (gear icon) in the sidebar
2. Click "API"
3. You'll see two keys:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)
4. Keep this page open - you'll need these values!

---

## Step 4: Add Keys to Your App

1. In your project folder (`C:\Users\dubni\Desktop\Studio`), create a file called `.env.local`
2. Add these lines (replace with your actual values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file
4. **IMPORTANT**: Never share these keys publicly or commit them to Git!

---

## Step 5: Create Database Tables

1. In Supabase dashboard, click "SQL Editor" in the sidebar
2. Click "New query"
3. Copy and paste the contents of `supabase_schema.sql` from your project
4. Click "Run" (or press Ctrl+Enter)
5. Wait for "Success" message
6. Repeat for `supabase_widgets_dashboard.sql`

**Quick way**: Run these files in order:
- ✅ `supabase_schema.sql` (main tables)
- ✅ `supabase_widgets_dashboard.sql` (widget persistence)
- ✅ `supabase_calendar.sql` (calendar features)
- ✅ `supabase_focus_scenes.sql` (study timer)
- ✅ `supabase_mock_exams.sql` (mock exams)

---

## Step 6: Enable Authentication

1. In Supabase dashboard, go to "Authentication" → "Providers"
2. Enable "Email" provider (should be on by default)
3. Optional: Enable other providers (Google, GitHub, etc.)
4. Go to "Authentication" → "URL Configuration"
5. Add your site URL (for local: `http://localhost:9002`)

---

## Step 7: Test Your Setup

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Open `http://localhost:9002`
3. Try these actions:
   - ✅ Sign up for a new account
   - ✅ Add a widget to your dashboard
   - ✅ Move widgets around
   - ✅ Refresh the page - widgets should stay!
   - ✅ Close and reopen - data persists!

---

## What's Now Saved to Database?

Once set up, these items automatically save:

✅ **Widget Layouts** - Position, size, locked/minimized state
✅ **Dashboard Settings** - Header image, preferences
✅ **Calendar Events** - All your scheduled events
✅ **Goals & Tasks** - Study goals and progress
✅ **Flashcards** - Cards and study progress
✅ **Notes** - All notes you create
✅ **Study Sessions** - Timer data and history
✅ **Subjects** - Your courses/subjects
✅ **User Profile** - Account settings

---

## Troubleshooting

### "Error: Invalid Supabase URL"
- Check that you copied the URL correctly from Supabase dashboard
- Make sure it starts with `https://` and ends with `.supabase.co`
- Restart your dev server after adding keys

### "Error: No API key found"
- Make sure `.env.local` file is in the root directory (same level as `package.json`)
- Variable names must be exact: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart your dev server

### "Row Level Security" errors
- Make sure you ran all the SQL files in the correct order
- Check that RLS policies were created (they're in the SQL files)
- In Supabase dashboard → "Authentication", verify you're logged in

### Data not saving
- Open browser console (F12) and check for errors
- Verify you're logged in to the app
- Check Supabase dashboard → "Table Editor" to see if tables exist
- Make sure your `.env.local` file has the correct keys

---

## Security Notes

🔒 **Your data is secure:**
- Row Level Security (RLS) ensures users only see their own data
- Passwords are encrypted
- API keys are client-safe (anon key)
- Never commit `.env.local` to Git (it's already in `.gitignore`)

---

## Deployment (Vercel)

When deploying to Vercel:

1. Go to your Vercel project → Settings → Environment Variables
2. Add the same two variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Redeploy your app
4. Update Supabase Authentication URLs to include your production URL

---

## Check Database Contents

Want to see your data?

1. Go to Supabase dashboard
2. Click "Table Editor"
3. Select any table (e.g., `widget_layouts`, `goals`, `calendar_events`)
4. View, edit, or delete data directly

---

## You're All Set! 🎉

Your app now has full database persistence! Users can:
- Close and reopen the app
- Switch devices (same account)
- Never lose their data

Everything saves automatically within 1 second of changes.

Need help? Check the Supabase docs at [supabase.com/docs](https://supabase.com/docs)
