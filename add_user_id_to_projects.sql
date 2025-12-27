-- Add user_id column to projects table for custom projects per user
-- Run this in your Supabase SQL Editor

-- Add user_id column if it doesn't exist
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.projects.user_id IS 'If NULL, project is global (visible to all). If set, project is custom and only visible to that user.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);


















