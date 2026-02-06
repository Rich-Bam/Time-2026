# Send Week Excel Email – Edge Function & Resend Verification

This document describes how to deploy and verify the **send-week-excel-email** edge function so that "Send Excel to email" after confirming a week works.

## When to use this

- After confirming a week, the "Send Excel to email" button fails (error toast or no email).
- You need to deploy or update the edge function, or check Resend secrets.

## 1. Deploy the edge function

The client calls `supabase.functions.invoke('send-week-excel-email', { body: { ... } })`. The function name must match exactly.

**Option A: Supabase Dashboard**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Edge Functions** → **Functions**.
3. If `send-week-excel-email` is missing: **Create new edge function**, name: `send-week-excel-email`.
4. Copy all code from `supabase/functions/send-week-excel-email/index.ts` into the editor.
5. **Deploy** / **Save**.

**Option B: CLI**

```bash
supabase functions deploy send-week-excel-email --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your project ref (e.g. from the dashboard URL).

## 2. Set required secrets

The function needs Resend credentials in Supabase Edge Function secrets.

1. In Supabase: **Edge Functions** → **Secrets** (or **Project Settings** → **Edge Functions** → **Secrets**).
2. Add:
   - **RESEND_API_KEY** – Your [Resend](https://resend.com) API key (required).
   - **RESEND_FROM_EMAIL** – Verified sender email in Resend (e.g. `noreply@bampro-uren.nl`). Optional; defaults to `support@bampro-uren.nl` in code.

Without `RESEND_API_KEY`, the function returns 500 and "RESEND_API_KEY secret is not configured".

## 3. Verify

**Browser**

1. Confirm a week and click "Send" in the "Send Excel to email" dialog.
2. Open DevTools → **Network**.
3. Find the request to `send-week-excel-email` (or your Supabase functions URL).
4. Check response: 200 + JSON `{ success: true, ... }` = OK; 4xx/5xx or body `{ error: "..." }` = failure.

**Supabase logs**

1. **Edge Functions** → **Logs** → select `send-week-excel-email`.
2. Look for "Edge Function called", "Sending email to ...", "Resend API response status", or errors (e.g. "RESEND_API_KEY secret is not configured", Resend API errors).

**Common issues**

| Symptom | Likely cause |
|--------|----------------|
| 404 or "function not found" | Function not deployed or wrong name (must be `send-week-excel-email`). |
| 500 + "RESEND_API_KEY secret is not configured" | Add `RESEND_API_KEY` in Edge Functions → Secrets. |
| 500 + Resend API error in logs | Invalid API key, unverified sender, or Resend quota/restrictions. |
| Success in logs but no email | Check recipient addresses (administratie + user), spam, and Resend dashboard for delivery status. |

## Summary

- Deploy **send-week-excel-email** (name exact).
- Set **RESEND_API_KEY** (and optionally **RESEND_FROM_EMAIL**) in Edge Function secrets.
- Verify via Network tab and Edge Function logs.
