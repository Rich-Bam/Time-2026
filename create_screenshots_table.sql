-- Create screenshots table for storing screenshot metadata
CREATE TABLE IF NOT EXISTS public.screenshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (admins making screenshots)
CREATE POLICY "Anyone can insert screenshots" ON public.screenshots
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only authenticated users can view screenshots
CREATE POLICY "Authenticated users can view screenshots" ON public.screenshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only super admin can delete screenshots
-- Note: You'll need to adjust this based on your auth setup
-- For now, we'll allow authenticated users to delete (you can restrict this further)
CREATE POLICY "Authenticated users can delete screenshots" ON public.screenshots
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON public.screenshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);









