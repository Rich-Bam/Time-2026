-- Create error_logs table for storing application errors
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_component TEXT,
  error_url TEXT,
  user_agent TEXT,
  browser_info TEXT,
  severity TEXT DEFAULT 'error', -- 'error', 'warning', 'info'
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert errors (so errors can be logged)
CREATE POLICY "Anyone can insert error logs" ON public.error_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only super admin can view error logs
-- Note: This checks for the super admin email
CREATE POLICY "Super admin can view error logs" ON public.error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = 'r.blance@bampro.nl'
      AND id::text = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Only super admin can update error logs (to mark as resolved)
CREATE POLICY "Super admin can update error logs" ON public.error_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = 'r.blance@bampro.nl'
      AND id::text = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Only super admin can delete error logs
CREATE POLICY "Super admin can delete error logs" ON public.error_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE email = 'r.blance@bampro.nl'
      AND id::text = (SELECT current_setting('request.jwt.claims', true)::json->>'sub')
    )
    OR auth.role() = 'service_role'
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);









