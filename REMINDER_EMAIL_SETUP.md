# Reminder Email Setup Guide

This guide explains how to set up email notifications for timesheet reminders using Resend.

## Overview

When admins send reminders via the Admin Panel, users will now receive:
1. **In-app reminder** (shown when they log in) - Already working
2. **Email reminder** (sent to their email address) - Requires setup below

## Prerequisites

1. A **Resend account** (free plan available: 3,000 emails/month)
2. Access to your **Supabase Dashboard**
3. The `send-reminder-email` Edge Function deployed

## Step 1: Create Resend Account

1. Go to **Resend**: https://resend.com
2. Sign up for a free account (or log in if you already have one)
3. Verify your email address

## Step 2: Create Resend API Key

1. Go to **Resend Dashboard** → **API Keys**: https://resend.com/api-keys
2. Click **"Create API Key"**
3. Give it a name (e.g., "BAMPRO Timesheet Reminders")
4. Select permissions: **"Sending access"**
5. Click **"Add"**
6. **Copy the API key** - you'll only see it once!

## Step 3: Verify Sender Email Domain

### Option A: Use Resend's Test Domain (Quick Start)

1. Go to **Resend Dashboard** → **Domains**
2. You'll see a default domain like `onboarding.resend.dev`
3. Use this as your sender email (e.g., `noreply@onboarding.resend.dev`)

**Note:** Test domain emails may go to spam. For production, use Option B.

### Option B: Verify Your Own Domain (Recommended for Production)

1. Go to **Resend Dashboard** → **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `bampro-uren.nl`)
4. Follow the DNS setup instructions to add the required DNS records
5. Wait for verification (usually a few minutes)
6. Once verified, you can use emails like `noreply@bampro-uren.nl`

## Step 4: Add Secrets to Supabase

1. Go to **Supabase Dashboard** → **Edge Functions** → **Secrets**
   - Or: **Project Settings** → **Edge Functions** → **Manage secrets**

2. Click **"Add new secret"** and add:

   **Secret 1:**
   - **Name:** `RESEND_API_KEY`
   - **Value:** Your Resend API key (from Step 2)
   - Click **"Save"**

   **Secret 2:**
   - **Name:** `RESEND_FROM_EMAIL`
   - **Value:** Your verified sender email (e.g., `noreply@onboarding.resend.dev` or `noreply@bampro-uren.nl`)
   - Click **"Save"**

   **Secret 3 (Optional):**
   - **Name:** `APP_URL`
   - **Value:** `https://bampro-uren.nl` (or your website URL)
   - Click **"Save"**

## Step 5: Deploy the Edge Function

**⚠️ IMPORTANT: The Edge Function MUST be deployed before reminder emails will work!**

### Option A: Via Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"** (or **"New function"** button)
3. **Function name:** `send-reminder-email` (must be exactly this name!)
4. Copy the **entire contents** of `supabase/functions/send-reminder-email/index.ts`
5. Paste it into the code editor
6. Click **"Deploy"** or **"Deploy function"**
7. Wait for deployment to complete (you'll see "Deployed successfully" or similar)
8. **Verify deployment:**
   - Check that `send-reminder-email` appears in the Functions list
   - Check that it has a URL (e.g., `https://...supabase.co/functions/v1/send-reminder-email`)
   - Check that "UPDATED" shows a recent time

### Option B: Via Supabase CLI

```bash
cd time-track-teamwork-excel-main
supabase functions deploy send-reminder-email --project-ref YOUR_PROJECT_REF
```

## Step 6: Test the Reminder Emails

1. Go to your website → **Admin Panel** → **Reminders** tab
2. Select one or more users
3. Enter a week number and year
4. Click **"Send Reminder"**
5. Check:
   - ✅ Toast message shows "Reminders and emails sent successfully"
   - ✅ Users receive an email in their inbox
   - ✅ Email has BAMPRO branding and correct week information

## Troubleshooting

### No emails received?

1. **Check spam/junk folder** - Emails might be filtered
2. **Check Resend Dashboard** → **Emails** - See if emails were sent and their status
3. **Check Supabase Dashboard** → **Edge Functions** → **Logs** - Look for errors
4. **Verify secrets are set correctly:**
   - Go to **Edge Functions** → **Secrets**
   - Check that `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are present
5. **Verify sender email is verified in Resend:**
   - Go to **Resend Dashboard** → **Domains**
   - Check that your sender email domain is verified

### Edge Function error?

1. **Check if function is deployed:**
   - Go to **Edge Functions** → Check if `send-reminder-email` exists
2. **Check function logs:**
   - Go to **Edge Functions** → **send-reminder-email** → **Logs**
   - Look for error messages
3. **Verify secrets:**
   - Make sure all required secrets are set
   - Re-deploy the function after adding secrets

### "RESEND_API_KEY secret is not configured" error?

1. Go to **Edge Functions** → **Secrets**
2. Add the `RESEND_API_KEY` secret
3. Re-deploy the Edge Function (secrets are loaded at deployment time)

### Emails going to spam?

1. **Use a verified domain** (not the test domain)
2. **Add SPF/DKIM records** to your domain DNS (Resend provides instructions)
3. **Warm up your domain** by sending a few test emails first
4. **Ask users to add sender to contacts**

## Email Content

The reminder emails include:
- **Subject:** "Timesheet Reminder - Week X of YYYY"
- **Greeting:** Personalized with user's name
- **Week information:** Week number, year, and date range
- **Custom message:** (if provided by admin)
- **Call-to-action button:** Link to the timesheet website
- **Professional styling:** BAMPRO branding with orange theme

All email content is in **English** as requested.

## Resend Limits

**Free Plan:**
- 3,000 emails per month
- 100 emails per day
- Good deliverability

**Pro Plan:**
- 50,000+ emails per month
- Higher daily limits
- Better deliverability
- Custom domains included

## Next Steps

After setup:
1. ✅ Test with a few users first
2. ✅ Monitor Resend Dashboard for delivery rates
3. ✅ Check spam rates and adjust if needed
4. ✅ Consider upgrading to Pro plan if sending many reminders

## Support

If you encounter issues:
1. Check **Resend Dashboard** → **Emails** for delivery status
2. Check **Supabase Dashboard** → **Edge Functions** → **Logs** for errors
3. Verify all secrets are correctly set
4. Test with a verified email address you have access to

