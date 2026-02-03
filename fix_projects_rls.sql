-- Fix RLS on projects so anon can INSERT (app uses custom auth, so role is always anon)
-- Run this in Supabase SQL Editor to fix "new row violates row-level security policy for table projects"

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Allow anon and service_role to view projects"
ON public.projects FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to insert projects"
ON public.projects FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to update projects"
ON public.projects FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

CREATE POLICY "Allow anon and service_role to delete projects"
ON public.projects FOR DELETE
USING (auth.role() = 'anon' OR auth.role() = 'service_role');
