-- ============================================
-- FIX RLS POLICY FOR TIMESHEET TABLE
-- ============================================
-- This script fixes the RLS policies on the timesheet table to allow
-- anonymous (anon) users to INSERT/UPDATE/DELETE, which is needed for
-- custom authentication.
--
-- PROBLEM: The application uses custom authentication, so auth.role() 
-- is always 'anon', not 'authenticated'. If the RLS policy requires
-- auth.role() = 'authenticated', timesheet operations will fail.
--
-- SOLUTION: Create policies that allow 'anon' role for all operations.
-- ============================================

-- Ensure RLS is enabled on timesheet table
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on timesheet table to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own timesheet entries or admins can view all" ON public.timesheet;
DROP POLICY IF EXISTS "Users can insert their own timesheet entries" ON public.timesheet;
DROP POLICY IF EXISTS "Users can update their own timesheet entries or admins can update all" ON public.timesheet;
DROP POLICY IF EXISTS "Users can delete their own timesheet entries or admins can delete all" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can view timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can insert timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can update timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Authenticated can delete timesheet" ON public.timesheet;
DROP POLICY IF EXISTS "Allow access to timesheet table" ON public.timesheet;

-- Create new policies that allow 'anon' and 'service_role' roles
-- This allows all timesheet operations to work with custom auth

-- SELECT policy: Allow all SELECT queries
CREATE POLICY "Allow anon and service_role to view timesheet"
ON public.timesheet FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- INSERT policy: Allow all INSERT queries
CREATE POLICY "Allow anon and service_role to insert timesheet"
ON public.timesheet FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

-- UPDATE policy: Allow all UPDATE queries
CREATE POLICY "Allow anon and service_role to update timesheet"
ON public.timesheet FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

-- DELETE policy: Allow all DELETE queries
CREATE POLICY "Allow anon and service_role to delete timesheet"
ON public.timesheet FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- DONE! Timesheet operations should work now.
-- ============================================
-- After running this script, you should be able to:
-- - Add hours (INSERT)
-- - Update hours (UPDATE)
-- - Delete hours (DELETE)
-- - View timesheet entries (SELECT)
-- ============================================

