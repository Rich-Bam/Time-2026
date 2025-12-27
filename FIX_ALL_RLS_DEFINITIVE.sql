-- ============================================
-- DEFINITIVE FIX: DROP ALL POLICIES AND RECREATE
-- ============================================
-- This script uses a loop to drop ALL existing policies
-- on all tables, then creates fresh policies.
-- This ensures NO old policies remain.
-- ============================================

-- Function to drop all policies on a table
CREATE OR REPLACE FUNCTION drop_all_policies_on_table(table_name text)
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. USERS TABLE
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
SELECT drop_all_policies_on_table('users');

CREATE POLICY "Allow anon and service_role to view users"
ON public.users FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 2. TIMESHEET TABLE
-- ============================================
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;
SELECT drop_all_policies_on_table('timesheet');

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
SELECT drop_all_policies_on_table('screenshots');

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
SELECT drop_all_policies_on_table('projects');

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
SELECT drop_all_policies_on_table('confirmed_weeks');

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
SELECT drop_all_policies_on_table('reminders');

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
-- 7. DAYS_OFF_NOTIFICATIONS TABLE
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'days_off_notifications') THEN
        ALTER TABLE public.days_off_notifications ENABLE ROW LEVEL SECURITY;
        PERFORM drop_all_policies_on_table('days_off_notifications');

        CREATE POLICY "Allow anon and service_role to view days_off_notifications"
        ON public.days_off_notifications FOR SELECT
        USING (auth.role() = 'anon' OR auth.role() = 'service_role');

        CREATE POLICY "Allow anon and service_role to insert days_off_notifications"
        ON public.days_off_notifications FOR INSERT
        WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

        CREATE POLICY "Allow anon and service_role to update days_off_notifications"
        ON public.days_off_notifications FOR UPDATE
        USING (auth.role() = 'anon' OR auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

        CREATE POLICY "Allow anon and service_role to delete days_off_notifications"
        ON public.days_off_notifications FOR DELETE
        USING (auth.role() = 'anon' OR auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================
-- 8. ERROR_LOGS TABLE (if exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
        ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
        PERFORM drop_all_policies_on_table('error_logs');

        CREATE POLICY "Allow all to insert error_logs"
        ON public.error_logs FOR INSERT
        WITH CHECK (true);

        CREATE POLICY "Allow service_role to view error_logs"
        ON public.error_logs FOR SELECT
        USING (auth.role() = 'service_role');

        CREATE POLICY "Allow service_role to update error_logs"
        ON public.error_logs FOR UPDATE
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

        CREATE POLICY "Allow service_role to delete error_logs"
        ON public.error_logs FOR DELETE
        USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS drop_all_policies_on_table(text);

-- ============================================
-- DONE! All RLS policies are now fixed for custom auth.
-- ============================================
-- All tables now allow 'anon' and 'service_role' roles.
-- Application-level security handles user-specific access control.
-- ============================================

