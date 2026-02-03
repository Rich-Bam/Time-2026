# Fix: Project Creation (RLS) and Shared Projects

## What you need to do

### Step 1: Run SQL in Supabase (required)

1. Open your **Supabase** project at https://supabase.com/dashboard.
2. Go to **SQL Editor**.
3. Open the file **`fix_projects_rls.sql`** in this repo and copy its contents, **or** run the SQL below.
4. Click **Run**. This fixes the "new row violates row-level security policy for table projects" error so users can create projects.

```sql
-- Fix RLS on projects so anon can INSERT (app uses custom auth, so role is always anon)
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
```

### Step 2: App code (already done)

The app has been updated so that **new projects are created as shared** (`user_id: null`). Any user who creates a project (from the calendar "+ Maak '…'" or from Project Management) will create a **global** project that all users can see and use.

- **WeeklyCalendarEntrySimple.tsx** — New projects created from the calendar dropdown use `user_id: null`.
- **WeeklyCalendarEntry.tsx** — All project-creation paths use `user_id: null`.
- **ProjectManagement.tsx** — New projects from the admin/management screen use `user_id: null`.

### Verify

1. Log in, go to a day, type a new project name (e.g. "Viking Keulen"), choose "+ Maak 'Viking Keulen'" and save. You should **not** see the RLS error.
2. Log in as another user; the new project should appear in the project list and be usable for time entries.
