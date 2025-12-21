-- Add can_use_timebuzzer column to users table
-- This column allows the super admin to control who can use Timebuzzer integration

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS can_use_timebuzzer BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.users.can_use_timebuzzer IS 'Whether the user is allowed to use Timebuzzer integration to sync their own time entries. Only the super admin can change this setting.';

