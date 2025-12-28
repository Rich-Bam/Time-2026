-- Fix RLS policy for invite-user Edge Function
-- This ensures the Edge Function (using service_role) can insert users
-- Run this in Supabase SQL Editor

-- Check if RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users via Edge Function" ON public.users;
DROP POLICY IF EXISTS "Users can insert users" ON public.users;

-- Create policy that allows service_role to insert users (Edge Functions use service_role)
-- This is the PRIMARY policy for Edge Functions
CREATE POLICY "Service role can insert users"
ON public.users FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Also allow admins to insert users (for direct admin panel inserts if needed)
-- Note: This policy checks if the current user is an admin
-- But Edge Functions should use service_role, so this is mainly for direct inserts
CREATE POLICY "Admins can insert users via Edge Function"
ON public.users FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
);

-- Verify the policies
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
AND cmd = 'INSERT';

