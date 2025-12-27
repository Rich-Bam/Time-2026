-- ⚠️ WARNING: This SQL script CANNOT hash passwords directly
-- SQL cannot run bcrypt hashing - you need to use the Edge Function instead
--
-- Use the Edge Function: supabase/functions/hash-all-passwords/index.ts
-- Or wait for users to log in (automatic migration)

-- This script is just for checking status:
SELECT 
  id,
  email,
  CASE 
    WHEN password LIKE '$2%' THEN 'hashed ✅'
    ELSE 'plaintext ⚠️'
  END as password_status,
  LENGTH(password) as password_length
FROM users
ORDER BY password_status, email;

-- To see count:
-- SELECT 
--   COUNT(*) FILTER (WHERE password LIKE '$2%') as hashed_count,
--   COUNT(*) FILTER (WHERE password NOT LIKE '$2%') as plaintext_count
-- FROM users;

















