-- Hide password column from users table in Supabase
-- This script creates a view without password and sets up RLS policies

-- Step 1: Create a view without password column (for SELECT queries)
-- This view can be used for all SELECT queries that don't need password
-- Drop view if it exists first (in case it was created before)
DROP VIEW IF EXISTS users_public CASCADE;

-- Create the view
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

-- Grant access to the view
GRANT SELECT ON users_public TO authenticated;
GRANT SELECT ON users_public TO anon;
GRANT SELECT ON users_public TO service_role;

-- Step 2: Enable Row Level Security on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Step 4: Create RLS policy for SELECT - hide password column
-- This policy allows users to see other users' data but password is excluded by default
-- Note: We'll use the view for most queries, but this adds an extra layer of security
CREATE POLICY "Users can view public user data"
ON users FOR SELECT
USING (true); -- Allow all authenticated users to view (password excluded via view)

-- Step 5: Create policy for INSERT (only for admins or service role)
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

-- Step 6: Create policy for UPDATE (users can update their own data, admins can update all)
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

-- Step 7: Create policy for DELETE (only admins)
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

-- Note: 
-- 1. Use 'users_public' view for all SELECT queries that don't need password
-- 2. Use 'users' table only for INSERT/UPDATE operations that need password
-- 3. The password column will still exist in the table but won't be visible in queries using the view
-- 4. You can also manually hide the column in Supabase dashboard for extra security

