-- Create fixed_days_off table for storing company-wide fixed holidays
-- These are holidays that apply to all users and are automatically deducted from their days off

CREATE TABLE IF NOT EXISTS public.fixed_days_off (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- admin user id who created the entry
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fixed_days_off ENABLE ROW LEVEL SECURITY;

-- Create index on date for faster lookups
CREATE INDEX IF NOT EXISTS idx_fixed_days_off_date ON public.fixed_days_off(date);

-- Policy: Anyone can view fixed days off (they're public company holidays)
CREATE POLICY "Anyone can view fixed days off" ON public.fixed_days_off
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert fixed days off
CREATE POLICY "Admins can insert fixed days off" ON public.fixed_days_off
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only admins can update fixed days off
CREATE POLICY "Admins can update fixed days off" ON public.fixed_days_off
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: Only admins can delete fixed days off
CREATE POLICY "Admins can delete fixed days off" ON public.fixed_days_off
  FOR DELETE
  USING (true);

-- Add comment
COMMENT ON TABLE public.fixed_days_off IS 'Company-wide fixed holidays that are automatically deducted from all users days off balance';
