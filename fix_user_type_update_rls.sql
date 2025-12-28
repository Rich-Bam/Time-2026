-- Fix RLS Policy for User Type Updates
-- This script fixes the RLS policy on the users table to allow admins to update user types
-- Run this in Supabase SQL Editor

-- Step 1: Drop existing UPDATE policy if it exists
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data or admins can update all" ON public.users;
DROP POLICY IF EXISTS "Authenticated can update users" ON public.users;

-- Step 2: Create a new UPDATE policy that works with custom authentication
-- This policy allows:
-- 1. Users to update their own data
-- 2. Admins to update any user (by checking if current user is admin)
-- 3. Service role to update any user
CREATE POLICY "Users can update their own data or admins can update all"
ON public.users FOR UPDATE
USING (
  -- Allow if user is updating their own record
  id::text = auth.uid()::text 
  -- OR allow if current user is an admin (check in users table)
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND ("isAdmin" = true OR "userType" IN ('admin', 'super_admin', 'administratie'))
  )
  -- OR allow service role
  OR auth.role() = 'service_role'
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND ("isAdmin" = true OR "userType" IN ('admin', 'super_admin', 'administratie'))
  )
  OR auth.role() = 'service_role'
);

-- Step 3: Verify the policy was created
-- Run this query to check:
-- SELECT * FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update their own data or admins can update all';

-- Note: If you're using custom authentication and auth.uid() is not working,
-- you may need to temporarily disable RLS for testing, or use service_role key
-- for admin operations. However, the above policy should work if auth.uid() 
-- is correctly set in your custom auth implementation.

