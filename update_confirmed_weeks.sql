-- Create confirmed_weeks table if it doesn't exist
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.confirmed_weeks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  confirmed BOOLEAN DEFAULT false,
  admin_approved BOOLEAN DEFAULT false,
  admin_reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Add admin_approved and admin_reviewed columns if they don't exist (in case table already existed)
ALTER TABLE public.confirmed_weeks
  ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_reviewed BOOLEAN DEFAULT false;

-- Update existing confirmed weeks to have admin_reviewed = false if they don't have it set
UPDATE public.confirmed_weeks
SET admin_reviewed = false
WHERE admin_reviewed IS NULL;

UPDATE public.confirmed_weeks
SET admin_approved = false
WHERE admin_approved IS NULL;

