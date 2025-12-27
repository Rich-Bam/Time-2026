-- ============================================
-- CHECK EXISTING POLICIES ON TIMESHEET TABLE
-- ============================================
-- Run this first to see what policies currently exist

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'timesheet'
ORDER BY policyname;

-- Also check all other tables
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

