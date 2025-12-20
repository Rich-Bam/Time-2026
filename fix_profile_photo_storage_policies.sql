-- Fix storage policies for profile-photos bucket
-- This ensures users can only upload/delete their own photos
-- Photos are stored in user-specific folders: {user_id}/{filename}

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;

-- Policy 1: Users can only upload photos to their own folder (user_id folder)
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'::text
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Public reads (anyone can view profile photos)
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-photos'::text);

-- Policy 3: Users can only delete photos from their own folder
CREATE POLICY "Users can delete their own profile photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'::text
  AND (storage.foldername(name))[1] = auth.uid()::text
);

