-- ============================================
-- FIX ALL RLS POLICIES FOR CUSTOM AUTH
-- ============================================
-- This script fixes ALL RLS policies to work with custom authentication.
-- The app uses custom auth, so auth.role() is always 'anon', not 'authenticated'.
--
-- This script fixes policies for:
-- - users
-- - timesheet
-- - screenshots
-- - projects
-- - confirmed_weeks
-- - reminders
-- - error_logs
-- ============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public user data" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can view users" ON public.users;
DROP POLICY IF EXISTS "Allow access to users table" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow anon and service_role to view users" ON public.users;

CREATE POLICY "Allow anon and service_role to view users"
ON public.users FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- 2. TIMESHEET TABLE
-- ============================================
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own timesheet entries or admins can view all" ON public.timesheet;
DROP POLICY IF EXISTS "Users can insert their own timesheet entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can update their own timesheet entries or admins can update all" ON public.timesheet;
DROP POLICY IF EXISTS "Users can delete their own timesheet entries or admins can delete all" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can view timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can insert timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can update timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can delete timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Allow access to timesheet table" ON public.timesheet;
-- Also drop the new policies in case they already exist from previous runs
DROP POLICY IF EXISTS "Allow anon and service_role to view timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Allow anon and service_role to insert timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Allow anon and service_role to update timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Allow anon and service_role to delete timesheet" ON public.timesheet;

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

DROP POLICY IF EXISTS "Anyone can insert screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Authenticated users can view screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Authenticated users can delete screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Authenticated can view screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Authenticated can insert screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Authenticated can delete screenshots" ON public.screenshots;
-- Also drop the new policies in case they already exist from previous runs
DROP POLICY IF EXISTS "Allow anon and service_role to view screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Allow anon and service_role to insert screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Allow anon and service_role to update screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Allow anon and service_role to delete screenshots" ON public.screenshots;

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

DROP POLICY IF EXISTS "Authenticated users can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects or admins can update all" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can view projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can update projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Allow access to projects table" ON public.projects;
-- Also drop the new policies in case they already exist from previous runs
DROP POLICY IF EXISTS "Allow anon and service_role to view projects" ON public.projects;
DROP POLICY IF EXISTS "Allow anon and service_role to insert projects" ON public.projects;
DROP POLICY IF EXISTS "Allow anon and service_role to update projects" ON public.projects;
DROP POLICY IF EXISTS "Allow anon and service_role to delete projects" ON public.projects;

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

DROP POLICY IF EXISTS "Users can view own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can insert own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can update own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Admins can view all confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Admins can update all confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can view confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can insert confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can update confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can delete confirmed weeks" ON public.confirmed_weeks;
-- Also drop the new policies in case they already exist from previous runs
DROP POLICY IF EXISTS "Allow anon and service_role to view confirmed_weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Allow anon and service_role to insert confirmed_weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Allow anon and service_role to update confirmed_weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Allow anon and service_role to delete confirmed_weeks" ON public.confirmed_weeks;

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

DROP POLICY IF EXISTS "Admins can insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Admins can delete reminders" ON public.reminders;
DROP POLICY IF EXISTS "Authenticated can view reminders" ON public.reminders;
DROP POLICY IF EXISTS "Authenticated can insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Authenticated can update reminders" ON public.reminders;
DROP POLICY IF EXISTS "Authenticated can delete reminders" ON public.reminders;
-- Also drop the new policies in case they already exist from previous runs
DROP POLICY IF EXISTS "Allow anon and service_role to view reminders" ON public.reminders;
DROP POLICY IF EXISTS "Allow anon and service_role to insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Allow anon and service_role to update reminders" ON public.reminders;
DROP POLICY IF EXISTS "Allow anon and service_role to delete reminders" ON public.reminders;

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
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
    ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Allow all to insert error_logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Super admin can view error logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Service role can view error logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Allow service_role to view error_logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Super admin can update error logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Service role can update error logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Allow service_role to update error_logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Super admin can delete error logs" ON public.error_logs;
    DROP POLICY IF EXISTS "Allow service_role to delete error_logs" ON public.error_logs;

    -- Allow anyone to insert error logs (for logging errors)
    CREATE POLICY "Allow all to insert error_logs"
    ON public.error_logs FOR INSERT
    WITH CHECK (true);

    -- Only service_role can view/update/delete (for security)
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

-- ============================================
-- DONE! All RLS policies are now fixed for custom auth.
-- ============================================
-- All tables now allow 'anon' and 'service_role' roles.
-- Application-level security handles user-specific access control.
-- ============================================

