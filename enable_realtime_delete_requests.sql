-- Enable real-time replication for delete_requests table
-- This allows real-time subscriptions to work for delete requests
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Check current replication status
-- ============================================
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'delete_requests'
    ) 
    THEN '✅ Real-time is ENABLED'
    ELSE '❌ Real-time is NOT ENABLED'
  END as realtime_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'delete_requests';

-- ============================================
-- STEP 2: Enable real-time replication
-- ============================================
-- Add delete_requests table to the supabase_realtime publication
-- This allows real-time subscriptions to listen for changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.delete_requests;

-- ============================================
-- STEP 3: Verify replication is enabled
-- ============================================
SELECT 
  schemaname,
  tablename,
  '✅ Real-time replication ENABLED' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND schemaname = 'public' 
  AND tablename = 'delete_requests';

-- ============================================
-- Note: If you get an error that the publication doesn't exist,
-- you may need to create it first:
-- ============================================
-- CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
-- Then run the ALTER PUBLICATION command above again
-- ============================================
