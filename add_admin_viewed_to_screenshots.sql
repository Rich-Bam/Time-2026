-- Add admin_viewed column to screenshots table to track which bug reports have been acknowledged by admin
ALTER TABLE public.screenshots 
ADD COLUMN IF NOT EXISTS admin_viewed BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on unviewed reports
CREATE INDEX IF NOT EXISTS idx_screenshots_admin_viewed ON public.screenshots(admin_viewed) WHERE admin_viewed = FALSE;




