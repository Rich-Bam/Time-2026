-- Complete setup script for days_off_notifications table
-- This script works with custom authentication
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create the table
-- ============================================
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

-- ============================================
-- STEP 2: Enable RLS
-- ============================================
ALTER TABLE public.days_off_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Drop existing policies (if any)
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert days off notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.days_off_notifications;

-- ============================================
-- STEP 4: Create RLS policies for custom auth
-- ============================================

-- Policy: Anyone can insert notifications (admins when making changes)
-- With custom auth, we allow all inserts since the app handles authentication
CREATE POLICY "Anyone can insert days off notifications" ON public.days_off_notifications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own notifications
-- For custom auth, we allow all selects, app will filter by user_id
CREATE POLICY "Users can view their own notifications" ON public.days_off_notifications
  FOR SELECT
  USING (true);

-- Policy: Users can update their own notifications (to mark as read)
CREATE POLICY "Users can update their own notifications" ON public.days_off_notifications
  FOR UPDATE
  USING (true);

-- Policy: Admins can delete notifications
CREATE POLICY "Admins can delete notifications" ON public.days_off_notifications
  FOR DELETE
  USING (true);

-- ============================================
-- STEP 5: Create indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_user_id ON public.days_off_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_read_at ON public.days_off_notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_user_unread ON public.days_off_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_created_at ON public.days_off_notifications(created_at DESC);

-- ============================================
-- Done! The table is now ready to use.
-- ============================================



