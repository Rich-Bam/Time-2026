# Quick Fix: Deploy Reminder Email Edge Function

If you see the error: **"Failed to send a request to the Edge Function"**, the Edge Function is not deployed yet.

## Quick Steps (5 minutes)

### 1. Open Supabase Dashboard
- Go to: https://supabase.com/dashboard
- Select your project

### 2. Create the Edge Function
1. Click **"Edge Functions"** in the left sidebar
2. Click **"Functions"** (under MANAGE)
3. Click **"Create a new function"** or **"New function"** button
4. **Function name:** Type exactly: `send-reminder-email`
5. Click **"Create"** or **"Continue"**

### 3. Paste the Code
1. Open the file: `supabase/functions/send-reminder-email/index.ts`
2. Select **ALL** the code (Ctrl+A / Cmd+A)
3. Copy it (Ctrl+C / Cmd+C)
4. Go back to Supabase Dashboard
5. Paste the code into the code editor (Ctrl+V / Cmd+V)

### 4. Deploy
1. Scroll down and click **"Deploy"** or **"Deploy function"** button
2. Wait 10-30 seconds for deployment
3. You should see: **"Deployed successfully"** or a green checkmark

### 5. Verify
1. Go back to **Edge Functions** → **Functions** list
2. You should see `send-reminder-email` in the list
3. It should have:
   - ✅ A URL (like `https://...supabase.co/functions/v1/send-reminder-email`)
   - ✅ "UPDATED" time (should say "just now" or recent time)
   - ✅ "DEPLOYMENTS" number (at least 1)

### 6. Test Again
1. Go to your website → **Admin Panel** → **Reminders** tab
2. Select users and send a reminder
3. You should now see: **"Reminders and emails sent successfully"** (or a different message if Resend is not configured yet)

## If You Still See Errors

### Error: "RESEND_API_KEY secret is not configured"
- Go to **Edge Functions** → **Secrets**
- Add secret: `RESEND_API_KEY` with your Resend API key
- Add secret: `RESEND_FROM_EMAIL` with your verified email
- **Re-deploy the function** (click Deploy again)

### Error: "Function not found" or 404
- Make sure the function name is exactly: `send-reminder-email` (no typos!)
- Check that it appears in the Functions list
- Try re-deploying the function

### Error: "Failed to send a request"
- Check that the function is deployed (see Step 5 above)
- Check Edge Function logs: **Edge Functions** → **send-reminder-email** → **Logs**
- Make sure you're using the correct Supabase project

## Need Help?

If it still doesn't work:
1. Check **Edge Functions** → **Logs** for error messages
2. Make sure you're in the correct Supabase project
3. Verify the function name is exactly `send-reminder-email` (case-sensitive)

