# Profile Page Setup

This guide explains how to set up the profile page functionality.

## Step 1: Add Database Columns

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Copy and paste the entire contents of `add_profile_fields.sql`
5. Click **Run** (or press Ctrl+Enter)
6. Wait for the script to complete successfully

This will add two new columns to the `users` table:
- `photo_url` - Stores the URL to the user's profile photo
- `phone_number` - Stores the user's mobile phone number

## Step 2: Create Storage Bucket for Profile Photos

1. Go to **Supabase Dashboard** → **Storage**
2. Click on **New bucket**
3. Bucket name: `profile-photos` (exact name, lowercase)
4. **Public bucket**: ✅ **ON** (check the box!)
5. **File size limit**: `5 MB` (or leave empty)
6. **Allowed MIME types**: Leave empty (or set to `image/*`)
7. Click **Create bucket**

### Storage Policies

After creating the bucket, you need to add policies so users can upload and view photos:

#### Policy 1: Upload (INSERT)
1. Click on the `profile-photos` bucket
2. Go to **Policies** tab
3. Click **New Policy**
4. Choose: **"Create a policy from scratch"** (or **"For full customization"**)
5. Fill in:
   - **Policy name:** `Allow authenticated uploads`
   - **Allowed operation:** Select **INSERT**
   - **Policy definition:** Paste this:
     ```sql
     (bucket_id = 'profile-photos'::text)
     ```
   - **WITH CHECK expression:** Paste this:
     ```sql
     (bucket_id = 'profile-photos'::text)
     ```
6. Click **Review** and then **Save policy**

#### Policy 2: Read (SELECT)
1. Click **New Policy** again
2. Fill in:
   - **Policy name:** `Allow public reads`
   - **Allowed operation:** Select **SELECT**
   - **Policy definition:** Paste this:
     ```sql
     (bucket_id = 'profile-photos'::text)
     ```
3. Click **Review** and then **Save policy**

#### Policy 3: Delete
1. Click **New Policy** again
2. Fill in:
   - **Policy name:** `Allow authenticated deletes`
   - **Allowed operation:** Select **DELETE**
   - **Policy definition:** Paste this:
     ```sql
     (bucket_id = 'profile-photos'::text)
     ```
3. Click **Review** and then **Save policy**

## Step 3: Test the Profile Page

1. Log in to the application
2. Click on **"Welcome, [Your Name]"** in the header
3. You should see the Profile page with:
   - Profile photo upload section
   - Name field (editable)
   - Email field (read-only)
   - Phone number field (editable)
   - Password change section
4. Try uploading a profile photo
5. Try updating your name and phone number
6. Try changing your password

## Features

- **Profile Photo**: Users can upload, change, or remove their profile photo
- **Name**: Users can update their display name
- **Email**: Displayed but cannot be changed (contact admin to change)
- **Phone Number**: Users can add or update their mobile phone number
- **Password**: Users can change their password (optional, leave blank to keep current password)

## Troubleshooting

### "Storage bucket missing" error
- Make sure you created the `profile-photos` bucket in Supabase Storage
- Check that the bucket name is exactly `profile-photos` (lowercase)

### "Permission denied" error
- Make sure all 3 storage policies are created (INSERT, SELECT, DELETE)
- Check that the bucket is set to **public**

### Photo not uploading
- Check browser console (F12) for errors
- Verify file size is under 5MB
- Verify file is an image (jpg, png, etc.)

### Database columns missing
- Run the `add_profile_fields.sql` script in Supabase SQL Editor
- Verify columns exist in Table Editor → users table

## Notes

- Profile photos are stored in Supabase Storage, not in the database
- The database only stores the URL to the photo
- Old photos are automatically deleted when a new one is uploaded
- Password changes are hashed before storage (using bcryptjs)

