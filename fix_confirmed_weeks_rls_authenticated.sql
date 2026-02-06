-- Fix confirmed_weeks RLS so authenticated (logged-in) users can SELECT/INSERT/UPDATE their own row.
-- Run this in Supabase SQL Editor if "Confirm Week" fails with RLS or permission errors.
--
-- Problem: Policies that only allow auth.role() = 'anon' OR 'service_role' block
-- logged-in users (role = 'authenticated'), so upsert in handleConfirmWeek fails.
--
-- This script replaces confirmed_weeks policies with ones that also allow
-- authenticated users to access their own row (user_id = auth.uid()::text).

-- Drop all known existing policies on confirmed_weeks
DROP POLICY IF EXISTS "Allow access to confirmed_weeks table" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Allow anon and service_role to view confirmed_weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Allow anon and service_role to insert confirmed_weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Allow anon and service_role to update confirmed_weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Allow anon and service_role to delete confirmed_weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can view their own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can insert their own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Users can update their own confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can view confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can insert confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can update confirmed weeks" ON public.confirmed_weeks;
DROP POLICY IF EXISTS "Authenticated can delete confirmed weeks" ON public.confirmed_weeks;

-- Ensure RLS is enabled
ALTER TABLE public.confirmed_weeks ENABLE ROW LEVEL SECURITY;

-- Allow: anon/service_role (e.g. edge functions) OR authenticated user accessing own row
CREATE POLICY "confirmed_weeks_select"
ON public.confirmed_weeks FOR SELECT
USING (
  auth.role() = 'anon' OR auth.role() = 'service_role'
  OR (auth.role() = 'authenticated' AND user_id = auth.uid()::text)
);

CREATE POLICY "confirmed_weeks_insert"
ON public.confirmed_weeks FOR INSERT
WITH CHECK (
  auth.role() = 'anon' OR auth.role() = 'service_role'
  OR (auth.role() = 'authenticated' AND user_id = auth.uid()::text)
);

CREATE POLICY "confirmed_weeks_update"
ON public.confirmed_weeks FOR UPDATE
USING (
  auth.role() = 'anon' OR auth.role() = 'service_role'
  OR (auth.role() = 'authenticated' AND user_id = auth.uid()::text)
)
WITH CHECK (
  auth.role() = 'anon' OR auth.role() = 'service_role'
  OR (auth.role() = 'authenticated' AND user_id = auth.uid()::text)
);

CREATE POLICY "confirmed_weeks_delete"
ON public.confirmed_weeks FOR DELETE
USING (
  auth.role() = 'anon' OR auth.role() = 'service_role'
  OR (auth.role() = 'authenticated' AND user_id = auth.uid()::text)
);
