-- ============================================
-- AGGRESSIVE FIX: DROP ALL POLICIES AND RECREATE
-- ============================================
-- This script DROPS ALL existing policies on all tables
-- and creates fresh policies that work with custom auth.
-- Use this if the normal fix script doesn't work.
-- ============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop ALL policies on users table (get all policy names and drop them)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.users';
    END LOOP;
END $$;

CREATE POLICY "Allow anon and service_role to view users"
ON public.users FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 2. TIMESHEET TABLE
-- ============================================
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;

-- Drop ALL policies on timesheet table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'timesheet') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.timesheet';
    END LOOP;
END $$;

-- Create new policies
CREATE POLICY "Allow anon and service_role to view timesheet"
ON public.timesheet FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to insert timesheet"
ON public.timesheet FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to update timesheet"
ON public.timesheet FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to delete timesheet"
ON public.timesheet FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 3. SCREENSHOTS TABLE
-- ============================================
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- Drop ALL policies on screenshots table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'screenshots') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.screenshots';
    END LOOP;
END $$;

CREATE POLICY "Allow anon and service_role to view screenshots"
ON public.screenshots FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to insert screenshots"
ON public.screenshots FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to update screenshots"
ON public.screenshots FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to delete screenshots"
ON public.screenshots FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 4. PROJECTS TABLE
-- ============================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop ALL policies on projects table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.projects';
    END LOOP;
END $$;

CREATE POLICY "Allow anon and service_role to view projects"
ON public.projects FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to insert projects"
ON public.projects FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to update projects"
ON public.projects FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to delete projects"
ON public.projects FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 5. CONFIRMED_WEEKS TABLE
-- ============================================
ALTER TABLE public.confirmed_weeks ENABLE ROW LEVEL SECURITY;

-- Drop ALL policies on confirmed_weeks table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'confirmed_weeks') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.confirmed_weeks';
    END LOOP;
END $$;

CREATE POLICY "Allow anon and service_role to view confirmed_weeks"
ON public.confirmed_weeks FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to insert confirmed_weeks"
ON public.confirmed_weeks FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to update confirmed_weeks"
ON public.confirmed_weeks FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to delete confirmed_weeks"
ON public.confirmed_weeks FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 6. REMINDERS TABLE
-- ============================================
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Drop ALL policies on reminders table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reminders') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.reminders';
    END LOOP;
END $$;

CREATE POLICY "Allow anon and service_role to view reminders"
ON public.reminders FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to insert reminders"
ON public.reminders FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to update reminders"
ON public.reminders FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to delete reminders"
ON public.reminders FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 7. ERROR_LOGS TABLE (if exists)
-- ============================================
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
        ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

        -- Drop ALL policies on error_logs table
        FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'error_logs') LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.error_logs';
        END LOOP;

        -- Allow anyone to insert error logs (for logging errors)
        EXECUTE 'CREATE POLICY "Allow all to insert error_logs" ON public.error_logs FOR INSERT WITH CHECK (true)';

        -- Only service_role can view/update/delete (for security)
        EXECUTE 'CREATE POLICY "Allow service_role to view error_logs" ON public.error_logs FOR SELECT USING (auth.role() = ''service_role'')';

        EXECUTE 'CREATE POLICY "Allow service_role to update error_logs" ON public.error_logs FOR UPDATE USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';

        EXECUTE 'CREATE POLICY "Allow service_role to delete error_logs" ON public.error_logs FOR DELETE USING (auth.role() = ''service_role'')';
    END IF;
END $$;

-- ============================================
-- DONE! All RLS policies are now fixed for custom auth.
-- ============================================
-- All tables now allow 'anon' and 'service_role' roles.
-- Application-level security handles user-specific access control.
-- ============================================

