-- ============================================
-- VERIFY RLS POLICIES - Check if they are correct
-- ============================================
-- Run this AFTER executing FIX_ALL_RLS_DEFINITIVE.sql
-- to verify that all policies are correctly set
-- ============================================

-- Check all policies on all tables
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%auth.role() = ''anon''%' OR qual LIKE '%auth.role() = ''service_role''%' OR qual LIKE '%auth.role() = ''anon'' OR auth.role() = ''service_role''%' THEN '✅ CORRECT'
        WHEN qual LIKE '%auth.role() = ''authenticated''%' THEN '❌ WRONG - requires authenticated'
        WHEN qual IS NULL AND with_check LIKE '%auth.role() = ''anon''%' THEN '✅ CORRECT'
        WHEN qual IS NULL AND with_check LIKE '%auth.role() = ''service_role''%' THEN '✅ CORRECT'
        WHEN qual IS NULL AND with_check LIKE '%true%' THEN '✅ CORRECT (allow all)'
        ELSE '⚠️ CHECK MANUALLY'
    END as policy_check,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'timesheet', 'screenshots', 'projects', 'confirmed_weeks', 'reminders', 'days_off_notifications', 'error_logs')
ORDER BY tablename, policyname;

-- Summary: Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(DISTINCT cmd::text, ', ') as operations
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'timesheet', 'screenshots', 'projects', 'confirmed_weeks', 'reminders', 'days_off_notifications', 'error_logs')
GROUP BY tablename
ORDER BY tablename;

-- Check if RLS is enabled on tables (you already ran this, but included for completeness)
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'timesheet', 'screenshots', 'projects', 'confirmed_weeks', 'reminders', 'days_off_notifications', 'error_logs')
ORDER BY tablename;

