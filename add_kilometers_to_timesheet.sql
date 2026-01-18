-- Add kilometers column to timesheet table for commute work types (20 and 21)
-- Run this in your Supabase SQL Editor

-- Add kilometers column if it doesn't exist
ALTER TABLE public.timesheet
  ADD COLUMN IF NOT EXISTS kilometers NUMERIC(10, 2);

-- Add comment to explain the column
COMMENT ON COLUMN public.timesheet.kilometers IS 'Kilometers traveled for commute work types (20: Commute Home-Work, 21: Commute Work-Work). Stored as decimal number (e.g., 15.5 km)';
