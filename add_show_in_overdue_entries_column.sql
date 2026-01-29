-- Add show_in_overdue_entries column to users table
-- This column allows the super admin to control who should be included in overdue weekly entries checks

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS show_in_overdue_entries BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.users.show_in_overdue_entries IS 'Whether the user should be included in overdue weekly entries checks. Only the super admin can change this setting.';
