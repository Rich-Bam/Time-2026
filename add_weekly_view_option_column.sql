-- Add weekly_view_option column to users table
-- This allows super admin to control which weekly entry view users can access
-- Options: 'simple' (Simple view only), 'original' (Original view only), 'both' (User can choose)

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS weekly_view_option TEXT DEFAULT 'both';

-- Update existing users to have 'both' as default (allows them to choose)
UPDATE public.users 
SET weekly_view_option = 'both' 
WHERE weekly_view_option IS NULL;

-- Add comment to column
COMMENT ON COLUMN public.users.weekly_view_option IS 'Controls weekly entry view access: simple (Simple only), original (Original only), both (User can choose)';





