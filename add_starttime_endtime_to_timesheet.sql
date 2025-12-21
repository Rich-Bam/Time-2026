-- Add startTime and endTime columns to timesheet table
-- Run this in your Supabase SQL Editor

-- Add startTime column if it doesn't exist
ALTER TABLE public.timesheet
  ADD COLUMN IF NOT EXISTS startTime TEXT;

-- Add endTime column if it doesn't exist
ALTER TABLE public.timesheet
  ADD COLUMN IF NOT EXISTS endTime TEXT;

-- Add comments to explain the columns
COMMENT ON COLUMN public.timesheet.startTime IS 'Start time in HH:mm format (e.g., "09:00")';
COMMENT ON COLUMN public.timesheet.endTime IS 'End time in HH:mm format (e.g., "17:00")';

