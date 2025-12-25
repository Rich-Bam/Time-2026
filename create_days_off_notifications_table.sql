-- Create days_off_notifications table for storing days off change notifications
CREATE TABLE IF NOT EXISTS public.days_off_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  hours_changed NUMERIC NOT NULL, -- Positive for added, negative for deducted
  days_changed NUMERIC NOT NULL, -- Calculated from hours (hours / 8)
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_by TEXT, -- admin user id who made the change
  admin_name TEXT -- admin name for display
);

-- Enable RLS
ALTER TABLE public.days_off_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert notifications (admins when making changes)
CREATE POLICY "Anyone can insert days off notifications" ON public.days_off_notifications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own notifications" ON public.days_off_notifications
  FOR SELECT
  USING (
    user_id = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
      AND "isAdmin" = true
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Users can update their own notifications (to mark as read)
CREATE POLICY "Users can update their own notifications" ON public.days_off_notifications
  FOR UPDATE
  USING (
    user_id = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
      AND "isAdmin" = true
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Admins can delete notifications
CREATE POLICY "Admins can delete notifications" ON public.days_off_notifications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
      AND "isAdmin" = true
    )
    OR auth.role() = 'service_role'
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_user_id ON public.days_off_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_read_at ON public.days_off_notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_user_unread ON public.days_off_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_created_at ON public.days_off_notifications(created_at DESC);



