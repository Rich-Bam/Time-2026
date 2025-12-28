-- ============================================
-- COMPLETE FIX: RLS Policy for invite-user Edge Function
-- ============================================
-- This script ensures Edge Functions (using service_role) can insert users
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Enable RLS (if not already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing INSERT policies to avoid conflicts
-- This ensures we start with a clean slate
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users via Edge Function" ON public.users;
DROP POLICY IF EXISTS "Users can insert users" ON public.users;
DROP POLICY IF EXISTS "Allow service role inserts" ON public.users;
DROP POLICY IF EXISTS "Allow admin inserts" ON public.users;

-- Step 3: Create PRIMARY policy for service_role (Edge Functions use this)
-- This is the most important policy - Edge Functions ALWAYS use service_role
CREATE POLICY "Service role can insert users"
ON public.users FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Step 4: Verify the policy was created
-- You should see at least one policy with cmd = 'INSERT'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND cmd = 'INSERT'
    AND policyname = 'Service role can insert users'
  ) THEN
    RAISE EXCEPTION 'Policy "Service role can insert users" was not created!';
  END IF;
END $$;

-- Step 5: Show all INSERT policies (for verification)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' 
AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Edge Functions ALWAYS use service_role
-- 2. This policy allows service_role to insert users
-- 3. If you still get RLS errors, check:
--    - Is RLS enabled? (should be true)
--    - Does the policy exist? (run the SELECT above)
--    - Is the Edge Function using service_role? (it should automatically)
-- ============================================

