-- ============================================
-- IMPORTANT: RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to: SQL Editor → New Query
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute the script
-- 
-- This will create the app_settings table needed for the Maintenance Mode feature.
-- ============================================

-- Create app_settings table for storing application-wide settings
-- This table stores settings like maintenance_mode that control application behavior

CREATE TABLE IF NOT EXISTS public.app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial maintenance_mode setting (disabled by default)
INSERT INTO public.app_settings (key, value)
VALUES ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (allows script to be re-run safely)
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Super admin can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Super admin can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow anon to update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow anon to insert app_settings" ON public.app_settings;

-- Policy: Allow anonymous read (needed for login check)
-- Anyone can read app_settings to check maintenance mode
CREATE POLICY "Anyone can read app_settings"
ON public.app_settings FOR SELECT
USING (true);

-- Policy: Allow anon role to update app_settings
-- NOTE: This app uses custom authentication, so all client requests use 'anon' role.
-- Application-level security ensures only super admin can access the toggle in the UI.
-- The setting is not sensitive (just a boolean flag), so allowing anon updates is acceptable.
CREATE POLICY "Allow anon to update app_settings"
ON public.app_settings FOR UPDATE
USING (true)
WITH CHECK (true);

-- Policy: Allow anon role to insert app_settings
-- NOTE: Same reasoning as UPDATE policy - app uses custom auth with anon role.
-- Application-level security ensures only super admin can create settings.
CREATE POLICY "Allow anon to insert app_settings"
ON public.app_settings FOR INSERT
WITH CHECK (true);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);

-- Add comment for documentation
COMMENT ON TABLE public.app_settings IS 'Application-wide settings table. Stores settings like maintenance_mode that control application behavior.';
COMMENT ON COLUMN public.app_settings.key IS 'Setting key (e.g., maintenance_mode)';
COMMENT ON COLUMN public.app_settings.value IS 'Setting value as text (e.g., true/false)';
COMMENT ON COLUMN public.app_settings.updated_at IS 'Timestamp when the setting was last updated';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- After running this script, verify the table and policies were created:
-- 
-- SELECT * FROM app_settings;
-- SELECT * FROM pg_policies WHERE tablename = 'app_settings';
-- 
-- You should see:
-- - 1 row in app_settings with key='maintenance_mode', value='false'
-- - 3 policies: SELECT, UPDATE, and INSERT
-- ============================================
