-- Add admin_approved and admin_reviewed columns to confirmed_weeks table
-- Run this in your Supabase SQL Editor

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

