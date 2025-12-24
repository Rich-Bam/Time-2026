-- IMPORTANT: This script migrates existing plaintext passwords to hashed passwords
-- DO NOT RUN THIS DIRECTLY - passwords must be hashed in the application code
-- This script is for reference only. The actual migration happens automatically
-- when users log in (see AuthSection.tsx handleLogin function)

-- The migration happens automatically:
-- 1. When a user logs in with a plaintext password, the system:
--    - Verifies the password matches
--    - Hashes the password using bcrypt
--    - Updates the password in the database
-- 2. All new passwords are automatically hashed when created

-- To manually verify which passwords are still plaintext:
-- SELECT id, email, 
--   CASE 
--     WHEN password LIKE '$2%' THEN 'hashed'
--     ELSE 'plaintext'
--   END as password_type
-- FROM users;

-- To see how many passwords need migration:
-- SELECT COUNT(*) as plaintext_passwords
-- FROM users
-- WHERE password NOT LIKE '$2%';









