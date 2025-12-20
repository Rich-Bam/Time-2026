-- Add status column to projects table for closing projects
-- Run this in your Supabase SQL Editor

-- Add status column if it doesn't exist (default to 'active')
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update existing projects to 'active' if status is NULL
UPDATE public.projects
SET status = 'active'
WHERE status IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.projects.status IS 'Project status: active (can add hours), closed (visible but cannot add hours), completed, on-hold';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);





