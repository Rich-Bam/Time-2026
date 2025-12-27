-- Enable RLS with Custom Authentication Support
-- This script enables RLS but allows access for authenticated requests
-- Since we use custom auth, we'll use a more permissive approach but still enable RLS

-- ============================================
-- STEP 1: Enable RLS on all tables
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmed_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Drop existing policies (if any)
-- ============================================

-- Users table
DROP POLICY IF EXISTS "Users can view public user data" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- Projects table
DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can update projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can delete projects" ON public.projects;

-- Timesheet table
DROP POLICY IF EXISTS "Users can view own entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can insert own entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can update own entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can delete own entries" ON public.timesheet;
DROP POLICY IF EXISTS "Admins can view all entries" ON public.timesheet;

-- Confirmed weeks table
DROP POLICY IF EXISTS "Users can view own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can insert own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can update own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Admins can view all confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Admins can update all confirmed weeks" ON public.confirmed_weeks;

-- Reminders table
DROP POLICY IF EXISTS "Admins can insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Admins can delete reminders" ON public.reminders;

-- Screenshots table
DROP POLICY IF EXISTS "Anyone can insert screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Authenticated users can view screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Authenticated users can delete screenshots" ON public.screenshots;

-- Error logs table
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admin can view error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admin can update error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admin can delete error logs" ON public.error_logs;

-- ============================================
-- STEP 3: Create new policies for custom auth
-- ============================================
-- These policies allow access for authenticated requests
-- Since we use custom auth, we allow authenticated role access
-- The application-level security handles user-specific access control

-- USERS TABLE
-- Allow authenticated users to view users (password is hidden via view)
CREATE POLICY "Authenticated can view users"
ON public.users FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow service role to insert users (for admin operations)
CREATE POLICY "Service role can insert users"
ON public.users FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to update (application controls who can update what)
CREATE POLICY "Authenticated can update users"
ON public.users FOR UPDATE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow service role to delete users
CREATE POLICY "Service role can delete users"
ON public.users FOR DELETE
USING (auth.role() = 'service_role');

-- PROJECTS TABLE
-- Allow authenticated users to view projects
CREATE POLICY "Authenticated can view projects"
ON public.projects FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to insert projects
CREATE POLICY "Authenticated can insert projects"
ON public.projects FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to update projects
CREATE POLICY "Authenticated can update projects"
ON public.projects FOR UPDATE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to delete projects
CREATE POLICY "Authenticated can delete projects"
ON public.projects FOR DELETE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- TIMESHEET TABLE
-- Allow authenticated users to view timesheet entries
CREATE POLICY "Authenticated can view timesheet"
ON public.timesheet FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to insert timesheet entries
CREATE POLICY "Authenticated can insert timesheet"
ON public.timesheet FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to update timesheet entries
CREATE POLICY "Authenticated can update timesheet"
ON public.timesheet FOR UPDATE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to delete timesheet entries
CREATE POLICY "Authenticated can delete timesheet"
ON public.timesheet FOR DELETE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- CONFIRMED WEEKS TABLE
-- Allow authenticated users to view confirmed weeks
CREATE POLICY "Authenticated can view confirmed weeks"
ON public.confirmed_weeks FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to insert confirmed weeks
CREATE POLICY "Authenticated can insert confirmed weeks"
ON public.confirmed_weeks FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to update confirmed weeks
CREATE POLICY "Authenticated can update confirmed weeks"
ON public.confirmed_weeks FOR UPDATE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to delete confirmed weeks
CREATE POLICY "Authenticated can delete confirmed weeks"
ON public.confirmed_weeks FOR DELETE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- REMINDERS TABLE
-- Allow authenticated users to view reminders
CREATE POLICY "Authenticated can view reminders"
ON public.reminders FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to insert reminders
CREATE POLICY "Authenticated can insert reminders"
ON public.reminders FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to update reminders
CREATE POLICY "Authenticated can update reminders"
ON public.reminders FOR UPDATE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to delete reminders
CREATE POLICY "Authenticated can delete reminders"
ON public.reminders FOR DELETE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- SCREENSHOTS TABLE
-- Allow authenticated users to view screenshots
CREATE POLICY "Authenticated can view screenshots"
ON public.screenshots FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to insert screenshots
CREATE POLICY "Authenticated can insert screenshots"
ON public.screenshots FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to delete screenshots
CREATE POLICY "Authenticated can delete screenshots"
ON public.screenshots FOR DELETE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ERROR LOGS TABLE
-- Allow anyone to insert error logs (so errors can be logged)
CREATE POLICY "Anyone can insert error logs"
ON public.error_logs FOR INSERT
WITH CHECK (true);

-- Allow service role to view error logs (super admin access via service role)
CREATE POLICY "Service role can view error logs"
ON public.error_logs FOR SELECT
USING (auth.role() = 'service_role');

-- Allow service role to update error logs
CREATE POLICY "Service role can update error logs"
ON public.error_logs FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Allow service role to delete error logs
CREATE POLICY "Service role can delete error logs"
ON public.error_logs FOR DELETE
USING (auth.role() = 'service_role');

-- ============================================
-- NOTES:
-- ============================================
-- 1. These policies require that requests are made with an authenticated role
-- 2. The application must use Supabase client with proper authentication
-- 3. User-specific access control is handled at the application level
-- 4. This provides a basic security layer while maintaining compatibility with custom auth
-- 5. For stricter security, consider migrating to Supabase Auth in the future









