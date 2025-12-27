-- ============================================
-- VERIFY RLS POLICIES - Check if policies are correct
-- ============================================
-- Run this script to verify that RLS policies are set up correctly
-- for the custom authentication system.
-- ============================================

-- Check all policies on users table
SELECT 
  policyname AS "Policy Name",
  cmd AS "Command",
  CASE 
    WHEN qual IS NULL THEN 'No condition'
    WHEN qual = 'true' THEN '✅ Allows all (CORRECT for SELECT)'
    WHEN qual LIKE '%anon%' THEN '✅ Allows anon (CORRECT for SELECT)'
    WHEN qual LIKE '%authenticated%' THEN '⚠️ Requires authenticated (INCORRECT - will block login!)'
    ELSE qual
  END AS "Condition",
  roles AS "Roles"
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- Specifically check SELECT policies
SELECT 
  'SELECT Policies on users table:' AS "Check",
  COUNT(*) AS "Count"
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'SELECT';

-- Check if there's a policy that allows anon or all
SELECT 
  'Policies that allow SELECT (should be > 0):' AS "Check",
  COUNT(*) AS "Count"
FROM pg_policies 
WHERE tablename = 'users' 
  AND cmd = 'SELECT'
  AND (
    qual = 'true' 
    OR qual LIKE '%anon%' 
    OR qual LIKE '%service_role%'
  );

-- Check if there's a policy that requires authenticated (BAD!)
SELECT 
  'Policies that REQUIRE authenticated (should be 0):' AS "WARNING",
  COUNT(*) AS "Count"
FROM pg_policies 
WHERE tablename = 'users' 
  AND cmd = 'SELECT'
  AND qual LIKE '%authenticated%'
  AND qual NOT LIKE '%anon%';

-- ============================================
-- INTERPRETATION:
-- ============================================
-- ✅ If "Policies that allow SELECT" > 0: Good!
-- ⚠️ If "Policies that REQUIRE authenticated" > 0: BAD! Login will fail!
-- ============================================

