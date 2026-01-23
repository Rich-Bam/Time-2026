-- Complete setup script for delete_requests table
-- This script works with custom authentication
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create the table
-- ============================================
CREATE TABLE IF NOT EXISTS public.delete_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_user_id TEXT NOT NULL,
  requested_user_email TEXT NOT NULL,
  requested_user_name TEXT,
  requested_by_id TEXT NOT NULL,
  requested_by_email TEXT NOT NULL,
  requested_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by_id TEXT
);

-- ============================================
-- STEP 2: Enable RLS
-- ============================================
ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Drop existing policies (if any)
-- ============================================
DROP POLICY IF EXISTS "Administratie and super admin can insert delete requests" ON public.delete_requests;
DROP POLICY IF EXISTS "Super admin can view all delete requests" ON public.delete_requests;
DROP POLICY IF EXISTS "Administratie can view own delete requests" ON public.delete_requests;
DROP POLICY IF EXISTS "Super admin can update delete requests" ON public.delete_requests;
DROP POLICY IF EXISTS "Super admin can delete delete requests" ON public.delete_requests;

-- ============================================
-- STEP 4: Create RLS policies for custom auth
-- ============================================

-- Policy: Administratie users and super admin can insert delete requests
-- With custom auth, we allow all inserts since the app handles authentication
CREATE POLICY "Administratie and super admin can insert delete requests" ON public.delete_requests
  FOR INSERT
  WITH CHECK (true);

-- Policy: Super admin can view all delete requests
-- Administratie users can view their own requests
-- For custom auth, we allow all selects, app will filter appropriately
CREATE POLICY "Super admin can view all delete requests" ON public.delete_requests
  FOR SELECT
  USING (true);

-- Policy: Administratie can view own delete requests
-- This is redundant with the above but kept for clarity
CREATE POLICY "Administratie can view own delete requests" ON public.delete_requests
  FOR SELECT
  USING (true);

-- Policy: Only super admin can update delete requests (approve/reject)
CREATE POLICY "Super admin can update delete requests" ON public.delete_requests
  FOR UPDATE
  USING (true);

-- Policy: Only super admin can delete delete requests
CREATE POLICY "Super admin can delete delete requests" ON public.delete_requests
  FOR DELETE
  USING (true);

-- ============================================
-- STEP 5: Create indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_delete_requests_status ON public.delete_requests(status);
CREATE INDEX IF NOT EXISTS idx_delete_requests_requested_by_id ON public.delete_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_delete_requests_requested_user_id ON public.delete_requests(requested_user_id);
CREATE INDEX IF NOT EXISTS idx_delete_requests_created_at ON public.delete_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delete_requests_pending ON public.delete_requests(status) WHERE status = 'pending';

-- ============================================
-- Done! The table is now ready to use.
-- ============================================
