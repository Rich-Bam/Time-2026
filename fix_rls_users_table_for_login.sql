-- ============================================
-- FIX RLS POLICY FOR USERS TABLE - ALLOW LOGIN
-- ============================================
-- This script fixes the RLS policy on the users table to allow
-- anonymous (anon) users to query the table for login purposes.
--
-- PROBLEM: The application uses custom authentication, so auth.role() 
-- is always 'anon', not 'authenticated'. If the RLS policy requires
-- auth.role() = 'authenticated', login queries will fail with "user not found".
--
-- SOLUTION: Create a policy that allows 'anon' role to SELECT from users table.
-- ============================================

-- Ensure RLS is enabled on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing SELECT policies on users table to avoid conflicts
-- (We'll create a new one that works with custom auth)
DROP POLICY IF EXISTS "Users can view public user data" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can view users" ON public.users;
DROP POLICY IF EXISTS "Allow access to users table" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Create new SELECT policy that allows 'anon' role (for custom auth login)
-- This allows the login query to work because the app uses anon role
CREATE POLICY "Allow anon and service_role to view users"
ON public.users FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- ============================================
-- VERIFY THE FIX
-- ============================================
-- After running this script, test login should work.
-- The policy now allows:
-- - 'anon' role (used by the app for custom auth login)
-- - 'service_role' (used by edge functions)
--
-- To verify, run this query in Supabase SQL Editor:
-- SELECT * FROM pg_policies WHERE tablename = 'users' AND policyname = 'Allow anon and service_role to view users';
-- ============================================

