-- ============================================
-- FIX PROJECTS RLS: Allow invited users (authenticated) to see and create projects
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
--
-- Problem: Invited users get a Supabase Auth session (role = authenticated).
-- Projects RLS only allowed anon and service_role, so they could not see or create projects.
--
-- Solution: Allow anon, authenticated, and service_role for all operations on projects.
-- ============================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (same names as fix_projects_rls.sql + any others)
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects or admins can update all" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can view projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can update projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Allow access to projects table" ON public.projects;
DROP POLICY IF EXISTS "Allow anon and service_role to view projects" ON public.projects;
DROP POLICY IF EXISTS "Allow anon and service_role to insert projects" ON public.projects;
DROP POLICY IF EXISTS "Allow anon and service_role to update projects" ON public.projects;
DROP POLICY IF EXISTS "Allow anon and service_role to delete projects" ON public.projects;

-- Allow anon, authenticated, and service_role for all operations
CREATE POLICY "Allow anon authenticated service_role to view projects"
ON public.projects FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon authenticated service_role to insert projects"
ON public.projects FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon authenticated service_role to update projects"
ON public.projects FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon authenticated service_role to delete projects"
ON public.projects FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'authenticated' OR auth.role() = 'service_role');
