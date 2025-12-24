-- SIMPLE VERSION: Just create the view (no RLS policies)
-- Use this if the full version gives errors

-- Drop view if exists
DROP VIEW IF EXISTS users_public CASCADE;

-- Create view without password column
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

-- Grant permissions
GRANT SELECT ON users_public TO authenticated;
GRANT SELECT ON users_public TO anon;
GRANT SELECT ON users_public TO service_role;









