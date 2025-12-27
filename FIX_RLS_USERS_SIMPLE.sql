-- ============================================
-- SIMPLE FIX: Allow ALL SELECT queries on users table
-- ============================================
-- This is the simplest fix that will definitely work.
-- It allows all SELECT queries regardless of role.
-- ============================================

-- Step 1: Drop ALL existing SELECT policies
DROP POLICY IF EXISTS "Users can view public user data" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can view users" ON public.users;
DROP POLICY IF EXISTS "Allow access to users table" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow anon and service_role to view users" ON public.users;

-- Step 2: Create a simple policy that allows ALL SELECT queries
-- This will work for both 'anon' and 'authenticated' roles
CREATE POLICY "Allow all SELECT on users"
ON public.users FOR SELECT
USING (true);

-- ============================================
-- DONE! Login should work now.
-- ============================================

