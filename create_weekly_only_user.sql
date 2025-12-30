-- Insert a new user with userType 'weekly_only'
-- This user can only access Weekly Entry functionality
-- They cannot access View Hours, Export, or Overview

INSERT INTO public.users (id, created_at, email, name, password, "isAdmin", must_change_password, approved, "userType")
VALUES
  (
    gen_random_uuid(), -- Generate a new UUID for the user ID
    NOW(),
    'weeklyonly@bampro.nl', -- Pas dit email aan
    'Weekly Only User', -- Pas deze naam aan
    'password123', -- Dit password zal automatisch gehasht worden bij eerste login
    FALSE,
    TRUE, -- Force password change on first login for security
    TRUE, -- Auto-approve for development
    'weekly_only' -- Set userType to 'weekly_only'
  )
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  "isAdmin" = EXCLUDED."isAdmin",
  must_change_password = EXCLUDED.must_change_password,
  approved = EXCLUDED.approved,
  "userType" = EXCLUDED."userType",
  created_at = EXCLUDED.created_at;

-- Verify the user was created
SELECT 
  id,
  email,
  name,
  "isAdmin",
  "userType",
  approved,
  must_change_password,
  created_at
FROM public.users
WHERE email = 'weeklyonly@bampro.nl';

