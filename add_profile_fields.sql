-- Add profile fields to users table
-- This script adds photo_url and phone_number columns for user profiles

-- Add photo_url column (stores URL to profile photo in Supabase Storage)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add phone_number column (stores user's mobile phone number)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.users.photo_url IS 'URL to user profile photo stored in Supabase Storage';
COMMENT ON COLUMN public.users.phone_number IS 'User mobile phone number';






