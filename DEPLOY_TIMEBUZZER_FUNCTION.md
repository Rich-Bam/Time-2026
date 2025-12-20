# How to Deploy Timebuzzer Edge Function

## Option 1: Via Supabase Dashboard (Easiest)

1. Go to Supabase Dashboard → **Edge Functions**
2. Click **"Create a new function"** or **"New Function"**
3. Name it: `timebuzzer-sync`
4. Copy the content from `supabase/functions/timebuzzer-sync/index.ts`
5. Paste it into the code editor
6. Click **"Deploy"** or **"Save"**

## Option 2: Via Supabase CLI

1. Make sure Supabase CLI is installed:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project (if not already linked):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy timebuzzer-sync
   ```

## Set Environment Variables

After deploying, you MUST set the environment variable:

1. Go to Supabase Dashboard → **Edge Functions** → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `TIMEBUZZER_API_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI`

## Verify Deployment

After deployment, verify:

1. Go to Supabase Dashboard → **Edge Functions** → **Functions**
2. You should see `timebuzzer-sync` in the list
3. Click on it to see details and logs

## Test the Function

After deployment, test it from the Admin Panel:
1. Go to Admin Panel → Timebuzzer Integration
2. Click **"Test API"**
3. Check browser console (F12) for the response

