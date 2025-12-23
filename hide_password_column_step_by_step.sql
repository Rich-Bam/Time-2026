-- ============================================
-- HIDE PASSWORD COLUMN - STEP BY STEP VERSION
-- ============================================
-- Run each section separately if you get errors
-- ============================================

-- ============================================
-- STEP 1: Drop view if it exists
-- ============================================
DROP VIEW IF EXISTS users_public CASCADE;

-- ============================================
-- STEP 2: Create the view without password
-- ============================================
CREATE VIEW users_public AS
SELECT 
  id,
  created_at,
  email,
  name,
  "isAdmin",
  must_change_password,
  approved
FROM users;

-- ============================================
-- STEP 3: Grant permissions on the view
-- ============================================
GRANT SELECT ON users_public TO authenticated;
GRANT SELECT ON users_public TO anon;
GRANT SELECT ON users_public TO service_role;

-- ============================================
-- STEP 4: Enable RLS (if not already enabled)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Drop old policies (if they exist)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view public user data" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- ============================================
-- STEP 6: Create SELECT policy
-- ============================================
CREATE POLICY "Users can view public user data"
ON users FOR SELECT
USING (true);

-- ============================================
-- STEP 7: Create INSERT policy
-- ============================================
CREATE POLICY "Admins can insert users"
ON users FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
  OR auth.role() = 'service_role'
);

-- ============================================
-- STEP 8: Create UPDATE policy
-- ============================================
CREATE POLICY "Users can update their own data"
ON users FOR UPDATE
USING (
  id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
  OR auth.role() = 'service_role'
)
WITH CHECK (
  id::text = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
  OR auth.role() = 'service_role'
);

-- ============================================
-- STEP 9: Create DELETE policy
-- ============================================
CREATE POLICY "Admins can delete users"
ON users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id::text = auth.uid()::text 
    AND "isAdmin" = true
  )
  OR auth.role() = 'service_role'
);








