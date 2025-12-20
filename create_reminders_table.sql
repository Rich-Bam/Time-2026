-- Create reminders table for storing timesheet reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_by TEXT -- admin user id who created the reminder
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can insert reminders
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can insert reminders" ON public.reminders;

CREATE POLICY "Admins can insert reminders" ON public.reminders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND "isAdmin" = true
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Users can view their own reminders
CREATE POLICY "Users can view their own reminders" ON public.reminders
  FOR SELECT
  USING (auth.uid()::text = user_id OR EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND "isAdmin" = true
  ));

-- Policy: Users can update their own reminders (to mark as read)
CREATE POLICY "Users can update their own reminders" ON public.reminders
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Admins can delete reminders
CREATE POLICY "Admins can delete reminders" ON public.reminders
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND "isAdmin" = true
  ));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_read_at ON public.reminders(read_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user_unread ON public.reminders(user_id, read_at) WHERE read_at IS NULL;

