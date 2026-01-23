-- Verification script for delete_requests table
-- Run this in Supabase SQL Editor to check if everything is set up correctly

-- ============================================
-- STEP 1: Check if table exists
-- ============================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'delete_requests'
    ) 
    THEN '✅ Table delete_requests EXISTS'
    ELSE '❌ Table delete_requests DOES NOT EXIST - Run create_delete_requests_table.sql'
  END as table_status;

-- ============================================
-- STEP 2: Check if RLS is enabled
-- ============================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'delete_requests'
      AND rowsecurity = true
    ) 
    THEN '✅ RLS is ENABLED'
    ELSE '❌ RLS is NOT ENABLED - Run: ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;'
  END as rls_status;

-- ============================================
-- STEP 3: Check if policies exist
-- ============================================
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'INSERT' THEN '✅ INSERT policy exists'
    WHEN cmd = 'SELECT' THEN '✅ SELECT policy exists'
    WHEN cmd = 'UPDATE' THEN '✅ UPDATE policy exists'
    WHEN cmd = 'DELETE' THEN '✅ DELETE policy exists'
    ELSE 'Policy exists'
  END as policy_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'delete_requests'
ORDER BY cmd;

-- ============================================
-- STEP 4: Check if indexes exist
-- ============================================
SELECT 
  indexname,
  CASE 
    WHEN indexname LIKE 'idx_delete_requests%' THEN '✅ Index exists'
    ELSE 'Index exists'
  END as index_status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'delete_requests'
ORDER BY indexname;

-- ============================================
-- STEP 5: Summary
-- ============================================
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delete_requests') as table_exists,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'delete_requests') as policy_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'delete_requests' AND indexname LIKE 'idx_delete_requests%') as index_count,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'delete_requests' 
      AND rowsecurity = true
    ) THEN true 
    ELSE false 
  END as rls_enabled;

-- ============================================
-- Expected Results:
-- ============================================
-- table_exists: 1
-- policy_count: 5 (INSERT, SELECT x2, UPDATE, DELETE)
-- index_count: 5 (status, requested_by_id, requested_user_id, created_at, pending)
-- rls_enabled: true
-- ============================================
