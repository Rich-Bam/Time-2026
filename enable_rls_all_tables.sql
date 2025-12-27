-- ============================================
-- Enable Row Level Security (RLS) for all tables
-- ============================================
-- This script enables RLS and creates policies for all tables
-- Run this in Supabase SQL Editor
-- ============================================
-- ⚠️ WARNING: This script uses auth.role() = 'authenticated' for users table
-- which will BLOCK LOGIN if you use custom authentication!
-- See RLS_POLICY_IMPORTANT.md for correct policy for users table.
-- ============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view public user data" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- ⚠️ WARNING: This policy will BLOCK LOGIN with custom authentication!
-- The app uses custom auth, so auth.role() is always 'anon', not 'authenticated'
-- This policy should be: USING (true) OR USING (auth.role() = 'anon' OR auth.role() = 'service_role')
-- Policy: Authenticated users can view all users (for user list, etc.)
-- ⚠️ DO NOT USE THIS FOR CUSTOM AUTH! Use FIX_RLS_USERS_SIMPLE.sql instead!
CREATE POLICY "Authenticated users can view all users"
ON public.users FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Only service role can insert users (via edge functions or admin panel)
CREATE POLICY "Service role can insert users"
ON public.users FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Policy: Users can update their own data, admins can update all
CREATE POLICY "Users can update their own data or admins can update all"
ON public.users FOR UPDATE
USING (
  id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- Policy: Only admins can delete users
CREATE POLICY "Admins can delete users"
ON public.users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
  OR auth.role() = 'service_role'
);

-- ============================================
-- 2. PROJECTS TABLE
-- ============================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects or admins can update all" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Policy: Authenticated users can view all projects
CREATE POLICY "Authenticated users can view all projects"
ON public.projects FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can create projects
CREATE POLICY "Authenticated users can insert projects"
ON public.projects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update their own projects, admins can update all
CREATE POLICY "Users can update their own projects or admins can update all"
ON public.projects FOR UPDATE
USING (
  user_id::text = auth.uid()::text 
  OR user_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- Policy: Users can delete their own projects, admins can delete all
CREATE POLICY "Users can delete their own projects or admins can delete all"
ON public.projects FOR DELETE
USING (
  user_id::text = auth.uid()::text 
  OR user_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- ============================================
-- 3. TIMESHEET TABLE
-- ============================================
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own timesheet entries" ON public.timesheet;
DROP POLICY IF EXISTS "Admins can view all timesheet entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can insert their own timesheet entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can update their own timesheet entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can delete their own timesheet entries" ON public.timesheet;
DROP POLICY IF EXISTS "Admins can delete all timesheet entries" ON public.timesheet;

-- Policy: Users can view their own entries, admins can view all
CREATE POLICY "Users can view their own timesheet entries or admins can view all"
ON public.timesheet FOR SELECT
USING (
  user_id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- Policy: Users can insert their own entries
CREATE POLICY "Users can insert their own timesheet entries"
ON public.timesheet FOR INSERT
WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Users can update their own entries, admins can update all
CREATE POLICY "Users can update their own timesheet entries or admins can update all"
ON public.timesheet FOR UPDATE
USING (
  user_id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- Policy: Users can delete their own entries, admins can delete all
CREATE POLICY "Users can delete their own timesheet entries or admins can delete all"
ON public.timesheet FOR DELETE
USING (
  user_id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- ============================================
-- 4. CONFIRMED_WEEKS TABLE
-- ============================================
ALTER TABLE public.confirmed_weeks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Admins can view all confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can insert their own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Admins can update confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Admins can delete confirmed weeks" ON public.confirmed_weeks;

-- Policy: Users can view their own confirmed weeks, admins can view all
CREATE POLICY "Users can view their own confirmed weeks or admins can view all"
ON public.confirmed_weeks FOR SELECT
USING (
  user_id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- Policy: Users can insert their own confirmed weeks
CREATE POLICY "Users can insert their own confirmed weeks"
ON public.confirmed_weeks FOR INSERT
WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Only admins can update confirmed weeks
CREATE POLICY "Admins can update confirmed weeks"
ON public.confirmed_weeks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- Policy: Only admins can delete confirmed weeks
CREATE POLICY "Admins can delete confirmed weeks"
ON public.confirmed_weeks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- ============================================
-- 5. REMINDERS TABLE (if exists)
-- ============================================
-- Check if table exists before enabling RLS
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminders') THEN
    ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admins can insert reminders" ON public.reminders;
    DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
    DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;
    DROP POLICY IF EXISTS "Admins can delete reminders" ON public.reminders;
    
    -- Policy: Admins can insert reminders
    CREATE POLICY "Admins can insert reminders"
    ON public.reminders FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id::text = auth.uid()::text 
        AND "isAdmin" = true
      )
      OR auth.role() = 'service_role'
    );
    
    -- Policy: Users can view their own reminders
    CREATE POLICY "Users can view their own reminders"
    ON public.reminders FOR SELECT
    USING (
      user_id::text = auth.uid()::text 
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id::text = auth.uid()::text 
        AND "isAdmin" = true
      )
    );
    
    -- Policy: Users can update their own reminders
    CREATE POLICY "Users can update their own reminders"
    ON public.reminders FOR UPDATE
    USING (user_id::text = auth.uid()::text);
    
    -- Policy: Admins can delete reminders
    CREATE POLICY "Admins can delete reminders"
    ON public.reminders FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id::text = auth.uid()::text 
        AND "isAdmin" = true
      )
      OR auth.role() = 'service_role'
    );
  END IF;
END $$;

-- ============================================
-- 6. SCREENSHOTS TABLE (if exists)
-- ============================================
-- Check if table exists before enabling RLS
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'screenshots') THEN
    ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Anyone can insert screenshots" ON public.screenshots;
    DROP POLICY IF EXISTS "Authenticated users can view screenshots" ON public.screenshots;
    DROP POLICY IF EXISTS "Authenticated users can delete screenshots" ON public.screenshots;
    
    -- Policy: Authenticated users can insert screenshots
    CREATE POLICY "Authenticated users can insert screenshots"
    ON public.screenshots FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
    
    -- Policy: Authenticated users can view screenshots
    CREATE POLICY "Authenticated users can view screenshots"
    ON public.screenshots FOR SELECT
    USING (auth.role() = 'authenticated');
    
    -- Policy: Authenticated users can delete screenshots
    CREATE POLICY "Authenticated users can delete screenshots"
    ON public.screenshots FOR DELETE
    USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Should show rowsecurity = true for all tables

-- ============================================
-- IMPORTANT NOTES
-- ============================================
-- 1. After enabling RLS, test your application thoroughly
-- 2. If you use service_role key in your application, it bypasses RLS
-- 3. Make sure your authentication is working correctly
-- 4. If you get "permission denied" errors, check the policies
-- 5. You can temporarily disable RLS for a table with:
--    ALTER TABLE public.tablename DISABLE ROW LEVEL SECURITY;
-- ============================================



