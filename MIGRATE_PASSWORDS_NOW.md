# Migrate All Passwords to Hashed Format - Instructions

## Current Situation
All passwords are still in plaintext format. They need to be hashed immediately for security.

## Option 1: Use Edge Function (Recommended - Fastest)

### Step 1: Deploy the Edge Function

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **Create a new function**
3. Name it: `hash-all-passwords`
4. Copy the contents of `supabase/functions/hash-all-passwords/index.ts`
5. Paste into the function editor
6. Click **Deploy**

### Step 2: Run the Function

**Option A: Via Supabase Dashboard**
1. Go to **Edge Functions** → **hash-all-passwords**
2. Click **Invoke**
3. Use **POST** method
4. Leave body empty: `{}`
5. Click **Invoke function**

**Option B: Via cURL (Terminal)**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/hash-all-passwords \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key (from Settings → API)

### Step 3: Verify

Run this SQL query in Supabase SQL Editor:
```sql
SELECT 
  email,
  CASE 
    WHEN password LIKE '$2%' THEN 'hashed ✅'
    ELSE 'plaintext ⚠️'
  END as status
FROM users;
```

All should show `hashed ✅` now!

## Option 2: Automatic Migration (Slower)

If you don't want to use the Edge Function, passwords will be automatically hashed when users log in. However, this means:
- Passwords remain plaintext until each user logs in
- Security risk until all users have logged in

## Option 3: Force Password Reset (Most Secure)

1. Set `must_change_password = true` for all users
2. Send password reset emails to all users
3. When they reset, passwords will be automatically hashed

**SQL to force password reset:**
```sql
UPDATE users 
SET must_change_password = true 
WHERE password NOT LIKE '$2%';
```

Then users will be prompted to change password on next login.

## Recommended Approach

**Use Option 1 (Edge Function)** - It's the fastest and most secure way to hash all passwords immediately.

## After Migration

Once all passwords are hashed:
1. ✅ All new passwords will be automatically hashed
2. ✅ Login will verify against hashes
3. ✅ No more plaintext passwords in database
4. ✅ You can hide the password column in Supabase dashboard for extra security

## Troubleshooting

**Edge Function not working?**
- Check that bcrypt is available in Deno (the function uses Deno's bcrypt)
- Verify service role key has correct permissions
- Check Edge Function logs in Supabase Dashboard

**Some passwords still plaintext?**
- Check the error details in the function response
- Manually hash those specific users via login or password reset

















