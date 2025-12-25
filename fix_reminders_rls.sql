-- Fix RLS policies for reminders table
-- Run this if you already created the reminders table but are getting RLS errors

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Admins can delete reminders" ON public.reminders;

-- Policy: Admins can insert reminders
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
  USING (
    auth.uid()::text = user_id 
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND "isAdmin" = true
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Users can update their own reminders (to mark as read)
CREATE POLICY "Users can update their own reminders" ON public.reminders
  FOR UPDATE
  USING (
    auth.uid()::text = user_id
    OR auth.role() = 'service_role'
  );

-- Policy: Admins can delete reminders
CREATE POLICY "Admins can delete reminders" ON public.reminders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND "isAdmin" = true
    )
    OR auth.role() = 'service_role'
  );











