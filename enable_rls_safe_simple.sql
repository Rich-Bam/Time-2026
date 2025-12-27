-- Safe RLS Enablement - Simple Version
-- This script ONLY enables RLS and creates policies
-- It does NOT drop existing policies (safer approach)
-- Run this if you want to avoid the "destructive operation" warning

-- ============================================
-- STEP 1: Enable RLS on all tables
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmed_weeks ENABLE ROW LEVEL SECURITY;

-- Enable RLS on optional tables (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminders') THEN
    ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'screenshots') THEN
    ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
    ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- STEP 2: Create policies (only if they don't exist)
-- ============================================

-- USERS TABLE
-- Create policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'Allow access to users table'
  ) THEN
    CREATE POLICY "Allow access to users table"
    ON public.users FOR ALL
    USING (auth.role() = 'anon' OR auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');
  END IF;
END $$;

-- PROJECTS TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'projects' 
    AND policyname = 'Allow access to projects table'
  ) THEN
    CREATE POLICY "Allow access to projects table"
    ON public.projects FOR ALL
    USING (auth.role() = 'anon' OR auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');
  END IF;
END $$;

-- TIMESHEET TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'timesheet' 
    AND policyname = 'Allow access to timesheet table'
  ) THEN
    CREATE POLICY "Allow access to timesheet table"
    ON public.timesheet FOR ALL
    USING (auth.role() = 'anon' OR auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');
  END IF;
END $$;

-- CONFIRMED WEEKS TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'confirmed_weeks' 
    AND policyname = 'Allow access to confirmed_weeks table'
  ) THEN
    CREATE POLICY "Allow access to confirmed_weeks table"
    ON public.confirmed_weeks FOR ALL
    USING (auth.role() = 'anon' OR auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');
  END IF;
END $$;

-- REMINDERS TABLE (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminders') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'reminders' 
      AND policyname = 'Allow access to reminders table'
    ) THEN
      CREATE POLICY "Allow access to reminders table"
      ON public.reminders FOR ALL
      USING (auth.role() = 'anon' OR auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

-- SCREENSHOTS TABLE (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'screenshots') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'screenshots' 
      AND policyname = 'Allow access to screenshots table'
    ) THEN
      CREATE POLICY "Allow access to screenshots table"
      ON public.screenshots FOR ALL
      USING (auth.role() = 'anon' OR auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

-- ERROR LOGS TABLE (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
    -- Allow anyone to insert (for error logging)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'error_logs' 
      AND policyname = 'Allow insert to error_logs'
    ) THEN
      CREATE POLICY "Allow insert to error_logs"
      ON public.error_logs FOR INSERT
      WITH CHECK (true);
    END IF;
    
    -- Only service_role can view/update/delete
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'error_logs' 
      AND policyname = 'Service role can manage error_logs'
    ) THEN
      CREATE POLICY "Service role can manage error_logs"
      ON public.error_logs FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, check if RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Should show rowsecurity = true for all tables

-- Check policies:
-- SELECT * FROM pg_policies WHERE schemaname = 'public';









