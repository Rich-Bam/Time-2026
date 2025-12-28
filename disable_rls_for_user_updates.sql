-- Temporarily disable RLS for UPDATE operations on users table
-- This allows user type updates to work with custom authentication
-- Run this in Supabase SQL Editor

-- Option 1: Disable RLS completely for users table (NOT RECOMMENDED for production)
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Option 2: Drop the UPDATE policy and create a permissive one (RECOMMENDED)
-- This keeps RLS enabled but allows all authenticated requests to update

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data or admins can update all" ON public.users;
DROP POLICY IF EXISTS "Authenticated can update users" ON public.users;

-- Create a permissive UPDATE policy that allows all updates
-- This works with custom authentication (anon key)
CREATE POLICY "Allow all authenticated updates"
ON public.users FOR UPDATE
USING (true)  -- Allow all rows to be updated
WITH CHECK (true);  -- Allow all values to be set

-- Note: This policy allows ANY authenticated user to update ANY user record
-- Make sure your application-level security (admin checks) is working correctly!

