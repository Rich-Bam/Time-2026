-- ============================================
-- FIX USERS RLS: Allow authenticated (invited users) to SELECT and UPDATE
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
--
-- Problem: After accepting an invite, the user has role = authenticated. They need to:
-- 1) Log in (SELECT from users by email) – may still be authenticated from invite flow
-- 2) Update password in public.users on invite-confirm page (UPDATE by email)
--
-- If users table only allows anon and service_role, invited users can get "user not found"
-- or fail to update password in public.users after setting it in Supabase Auth.
--
-- Solution: Allow authenticated for SELECT and UPDATE on users (same as anon for these).
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy so we can replace with one that includes authenticated
DROP POLICY IF EXISTS "Allow anon and service_role to view users" ON public.users;
DROP POLICY IF EXISTS "Users can view public user data" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can view users" ON public.users;
DROP POLICY IF EXISTS "Allow access to users table" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- SELECT: anon (custom login) and authenticated (invite flow) and service_role
CREATE POLICY "Allow anon authenticated service_role to view users"
ON public.users FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- UPDATE: anon (custom login password hash update), authenticated (invite-confirm password update), service_role
DROP POLICY IF EXISTS "Allow authenticated to update users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can update users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own" ON public.users;
DROP POLICY IF EXISTS "Allow anon authenticated service_role to update users" ON public.users;
CREATE POLICY "Allow anon authenticated service_role to update users"
ON public.users FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role');
