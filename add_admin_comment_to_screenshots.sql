-- Add admin_comment column to screenshots table for admin feedback to reporters
ALTER TABLE public.screenshots 
ADD COLUMN IF NOT EXISTS admin_comment TEXT;

-- When the admin comment was added
ALTER TABLE public.screenshots 
ADD COLUMN IF NOT EXISTS admin_comment_at TIMESTAMP WITH TIME ZONE;
