# Debug Reminder Email Not Sending

Follow these steps to find out why emails are not being sent:

## Step 1: Check Browser Console

1. Open your website in browser
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Send a reminder from Admin Panel → Reminders tab
5. Look for these messages:
   - ✅ "Calling send-reminder-email edge function..."
   - ✅ "Email sending result:" - What does it show?
   - ❌ Any error messages? - Copy them here

**What to look for:**
- If you see "404" error → Edge function is not deployed
- If you see "RESEND_API_KEY secret is not configured" → Secrets missing
- If you see network errors → Edge function deployment issue

## Step 2: Check What Toast Message You See

When you send a reminder, what toast notification appears?

- ✅ "Reminders and Emails Sent" → Emails should be sent, check inbox/spam
- ⚠️ "Reminders saved, but emails were not sent..." → Edge function not deployed (404)
- ⚠️ "Reminders saved, but email sending failed: ..." → Check the error message
- ⚠️ "Reminders saved, but email sending encountered an error" → Check console

## Step 3: Check Supabase Edge Function Deployment

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** → **Functions**
4. Look for `send-reminder-email` in the list

**If function DOES NOT exist:**
- ❌ This is the problem! Function needs to be deployed
- Follow: `QUICK_DEPLOY_REMINDER_EMAIL.md`

**If function EXISTS:**
- Click on `send-reminder-email`
- Check "UPDATED" time - is it recent?
- If not recent, click "Deploy" or "Redeploy" button

## Step 4: Check Supabase Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Click on `send-reminder-email` (or search for it)
3. Look at recent logs
4. Send a reminder again and check logs immediately

**What to look for:**
- ❌ No logs at all? → Function is not being called (check Step 1)
- ❌ "RESEND_API_KEY secret is not configured" → Secrets missing
- ❌ "User has no email address" → User email missing
- ❌ Resend API errors → Check Resend setup
- ✅ "Email sent successfully" → Emails are being sent, check spam folder

## Step 5: Check Supabase Secrets

1. Go to **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Check if these secrets exist:
   - ✅ `RESEND_API_KEY` - Should have a value (hidden)
   - ✅ `RESEND_FROM_EMAIL` - Should be like `noreply@onboarding.resend.dev` or your domain
   - ⚠️ `APP_URL` (optional) - Can be `https://bampro-uren.nl`

**If secrets are missing:**
- Add them following `ADD_RESEND_SECRETS.md`
- **IMPORTANT:** After adding secrets, re-deploy the edge function!

## Step 6: Re-deploy Edge Function (Important!)

After adding or changing secrets, you MUST re-deploy:

1. Go to **Edge Functions** → **Functions** → `send-reminder-email`
2. Scroll down
3. Click **"Deploy"** or **"Redeploy"** button
4. Wait for "Deployed successfully" message
5. Check "UPDATED" time shows "just now"

## Step 7: Check Resend Setup

1. Go to **Resend Dashboard**: https://resend.com
2. Check **API Keys** - Do you have an API key?
3. Check **Domains** - Is your sender domain verified?
4. Check **Emails** - Are there any recent emails? What's their status?

**Common issues:**
- API key expired or invalid
- Domain not verified
- Using test domain (emails might go to spam)
- Resend account limit reached

## Step 8: Test with Browser Console

Open browser console (F12) on your website and run:

```javascript
// Replace with actual user ID from your database
const testPayload = {
  userIds: ["YOUR_USER_ID_HERE"], // Get from users table
  weekNumber: 1,
  year: 2026,
  message: "Test reminder"
};

const { data, error } = await supabase.functions.invoke('send-reminder-email', {
  body: testPayload
});

console.log("Response:", data);
console.log("Error:", error);
```

**What you should see:**
- `data.sent` - Number of emails sent
- `data.failed` - Number of failed emails
- `data.errors` - Array of errors (if any)

## Quick Checklist

- [ ] Browser console shows "Calling send-reminder-email edge function..."
- [ ] Edge function `send-reminder-email` exists in Supabase
- [ ] Edge function was deployed/redeployed recently
- [ ] `RESEND_API_KEY` secret exists in Supabase
- [ ] `RESEND_FROM_EMAIL` secret exists in Supabase
- [ ] Edge function was redeployed AFTER adding secrets
- [ ] Resend API key is valid
- [ ] Resend sender domain is verified
- [ ] User emails exist in database
- [ ] Check spam/junk folder

## Common Errors and Solutions

### "404" or "Function not found"
→ Edge function not deployed. Deploy it in Supabase Dashboard.

### "RESEND_API_KEY secret is not configured"
→ Add `RESEND_API_KEY` secret and re-deploy function.

### "User has no email address"
→ User in database doesn't have email field set.

### "Resend API error: Invalid API key"
→ Resend API key is wrong or expired. Get new key from Resend.

### "Domain not verified"
→ Verify your sender domain in Resend Dashboard.

### Emails sent but not received
→ Check spam folder, check Resend Dashboard → Emails for delivery status.

