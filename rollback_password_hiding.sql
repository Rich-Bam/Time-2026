-- Rollback script: Remove users_public view and RLS policies
-- This will restore the database to the state before password hiding was implemented
-- Run this in Supabase SQL Editor if you want to completely remove the password hiding changes

-- Step 1: Drop the users_public view
DROP VIEW IF EXISTS users_public CASCADE;

-- Step 2: Remove RLS policies that were added for password hiding
-- (Only remove if they were added - check first if they exist)
DROP POLICY IF EXISTS "Users can view public user data" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Note: We're NOT disabling RLS completely, just removing the policies we added
-- If RLS was already enabled before, it will remain enabled but without our custom policies

-- Step 3: Verify
-- Run this to check if the view is gone:
-- SELECT * FROM information_schema.views WHERE table_name = 'users_public';
-- Should return no rows

-- IMPORTANT: Password hashing in the application code is still active
-- This only removes the database view and RLS policies
-- Passwords will still be hashed when stored, but the view is removed




