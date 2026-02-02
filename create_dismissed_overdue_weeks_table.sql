-- Create dismissed_overdue_weeks table
-- Stores (user_id, week_start_date) pairs that admins have dismissed from the overdue list.
-- Run this in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.dismissed_overdue_weeks (
  user_id TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_by TEXT,
  PRIMARY KEY (user_id, week_start_date)
);

COMMENT ON TABLE public.dismissed_overdue_weeks IS 'Overdue weekly entries that admins have dismissed from the list (hidden, not confirmed)';
COMMENT ON COLUMN public.dismissed_overdue_weeks.dismissed_by IS 'User ID of the admin who dismissed the entry';

-- Enable RLS
ALTER TABLE public.dismissed_overdue_weeks ENABLE ROW LEVEL SECURITY;

-- Policy: same pattern as confirmed_weeks (anon/service_role for app access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'dismissed_overdue_weeks'
    AND policyname = 'Allow access to dismissed_overdue_weeks table'
  ) THEN
    CREATE POLICY "Allow access to dismissed_overdue_weeks table"
    ON public.dismissed_overdue_weeks FOR ALL
    USING (auth.role() = 'anon' OR auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');
  END IF;
END $$;
