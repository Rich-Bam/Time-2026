-- Add email tracking fields to confirmed_weeks table
-- Run this in your Supabase SQL Editor

-- Add email tracking columns
ALTER TABLE public.confirmed_weeks
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_sent_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rejection_email_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unlock_email_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.confirmed_weeks.email_sent_at IS 'Timestamp when confirmation email with Excel was sent';
COMMENT ON COLUMN public.confirmed_weeks.email_sent_by IS 'User ID who triggered the email (or system)';
COMMENT ON COLUMN public.confirmed_weeks.rejection_email_sent_at IS 'Timestamp when rejection email with Excel was sent';
COMMENT ON COLUMN public.confirmed_weeks.unlock_email_sent_at IS 'Timestamp when unlock email with Excel was sent';
