-- Add userType column to users table
-- This column stores the user type: 'user', 'administratie', 'admin', or 'super_admin'

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'userType'
    ) THEN
        ALTER TABLE users ADD COLUMN "userType" TEXT;
        
        -- Set default values based on existing isAdmin field
        UPDATE users 
        SET "userType" = CASE 
            WHEN email = 'r.blance@bampro.nl' THEN 'super_admin'
            WHEN "isAdmin" = true THEN 'admin'
            ELSE 'user'
        END;
        
        -- Add comment to column
        COMMENT ON COLUMN users."userType" IS 'User type: user, administratie, admin, or super_admin';
    END IF;
END $$;











