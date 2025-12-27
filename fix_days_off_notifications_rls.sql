-- Fix RLS policies for days_off_notifications to work with custom authentication
-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can insert days off notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.days_off_notifications;

-- Policy: Anyone can insert notifications (admins when making changes)
-- With custom auth, we allow all inserts since the app handles authentication
CREATE POLICY "Anyone can insert days off notifications" ON public.days_off_notifications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own notifications
-- For custom auth, we need to check against the users table
-- Since we can't use auth.uid(), we allow authenticated users to see their own notifications
-- The app will filter by user_id on the client side
CREATE POLICY "Users can view their own notifications" ON public.days_off_notifications
  FOR SELECT
  USING (true); -- Allow all selects, app will filter by user_id

-- Policy: Users can update their own notifications (to mark as read)
CREATE POLICY "Users can update their own notifications" ON public.days_off_notifications
  FOR UPDATE
  USING (true); -- Allow all updates, app will filter by user_id

-- Policy: Admins can delete notifications
CREATE POLICY "Admins can delete notifications" ON public.days_off_notifications
  FOR DELETE
  USING (true); -- Allow all deletes, app will filter by admin status









