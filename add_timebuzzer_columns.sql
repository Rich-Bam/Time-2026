-- Add Timebuzzer integration columns to database tables

-- Add timebuzzer_user_id to users table for user mapping
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS timebuzzer_user_id TEXT;

COMMENT ON COLUMN public.users.timebuzzer_user_id IS 'Timebuzzer user ID for syncing time entries';

-- Add timebuzzer_project_id to projects table for project mapping
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS timebuzzer_project_id TEXT;

COMMENT ON COLUMN public.projects.timebuzzer_project_id IS 'Timebuzzer project/tile ID for syncing time entries';

-- Add timebuzzer_activity_id to timesheet table to prevent duplicate syncing
ALTER TABLE public.timesheet 
ADD COLUMN IF NOT EXISTS timebuzzer_activity_id TEXT;

-- Create unique index on timebuzzer_activity_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS timesheet_timebuzzer_activity_id_unique 
ON public.timesheet(timebuzzer_activity_id) 
WHERE timebuzzer_activity_id IS NOT NULL;

COMMENT ON COLUMN public.timesheet.timebuzzer_activity_id IS 'Timebuzzer activity ID to prevent duplicate syncing';








