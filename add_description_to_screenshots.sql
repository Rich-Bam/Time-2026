-- Add description/note field to screenshots table
ALTER TABLE public.screenshots 
ADD COLUMN IF NOT EXISTS description TEXT;


