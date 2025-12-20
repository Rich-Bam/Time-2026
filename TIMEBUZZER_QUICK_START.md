# Timebuzzer Quick Start Guide

## Step 1: Configure API Key in Supabase

1. Go to Supabase Dashboard → **Edge Functions** → **Settings** → **Environment Variables**
2. Add a new environment variable:
   - **Name**: `TIMEBUZZER_API_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI`

## Step 2: Deploy Edge Function

```bash
cd time-track-teamwork-excel-main
supabase functions deploy timebuzzer-sync
```

## Step 3: Run Database Schema Update

In Supabase SQL Editor, run:

```sql
-- Add Timebuzzer integration columns to database tables

-- Add timebuzzer_user_id to users table for user mapping
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS timebuzzer_user_id TEXT;

-- Add timebuzzer_project_id to projects table for project mapping
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS timebuzzer_project_id TEXT;

-- Add timebuzzer_activity_id to timesheet table to prevent duplicate syncing
ALTER TABLE public.timesheet 
ADD COLUMN IF NOT EXISTS timebuzzer_activity_id TEXT;

-- Create unique index on timebuzzer_activity_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS timesheet_timebuzzer_activity_id_unique 
ON public.timesheet(timebuzzer_activity_id) 
WHERE timebuzzer_activity_id IS NOT NULL;
```

## Step 4: Test the API Connection

1. Go to Admin Panel in your app
2. Scroll to "Timebuzzer Integration" section
3. Click **"Test API"** button
4. Check browser console (F12) to see what the API returns

## Step 5: Map Richard Blance User

After testing the API, you'll need to:

1. Find Richard Blance's Timebuzzer user ID from the API response
2. Map it to your local user:

```sql
-- Update Richard Blance's user with Timebuzzer user ID
-- Replace 'TIMEBUZZER_USER_ID_HERE' with the actual ID from API response
UPDATE public.users 
SET timebuzzer_user_id = 'TIMEBUZZER_USER_ID_HERE'
WHERE email = 'r.blance@bampro.nl';
```

## Step 6: Map Projects

Similarly, map projects:

```sql
-- Update projects with Timebuzzer project IDs
-- Replace with actual IDs from API response
UPDATE public.projects 
SET timebuzzer_project_id = 'TIMEBUZZER_PROJECT_ID_HERE'
WHERE name = 'Project Name';
```

## Step 7: Sync Time Entries

1. Go to Admin Panel → Timebuzzer Integration
2. Select start date and end date
3. Click **"Sync from Timebuzzer"**
4. Check if entries are synced correctly

## Important Notes

- The API key is currently hardcoded for testing. Make sure to add it to Supabase environment variables.
- Only entries for users that have `timebuzzer_user_id` mapped will be synced.
- Only entries for projects that have `timebuzzer_project_id` mapped will be synced.
- The sync prevents duplicates using `timebuzzer_activity_id`.




