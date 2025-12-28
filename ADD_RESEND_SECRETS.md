# Add Resend Secrets to Supabase - Quick Guide

Je hebt al:
- ✅ Edge Function `send-reminder-email` gedeployed
- ✅ Resend API key aangemaakt: "BAMPRO Timesheet Reminders"

Nu moet je de secrets toevoegen aan Supabase:

## Stap 1: Kopieer je Resend API Key

1. Ga naar **Resend Dashboard** → **API Keys**
2. Klik op **"BAMPRO Timesheet Reminders"**
3. Klik op het **oog-icoon** of **"Show"** om de volledige API key te zien
4. Kopieer de **volledige API key** (begint met `re_...`)
   - Bijvoorbeeld: `re_3rDFb7RP...` (kopieer de HELE key!)

## Stap 2: Voeg Secrets toe in Supabase

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Secrets**
   - Of: **Project Settings** → **Edge Functions** → **Manage secrets**

2. Klik op **"Add new secret"** of **"New secret"**

3. **Secret 1: RESEND_API_KEY**
   - **Name:** `RESEND_API_KEY` (exact deze naam, hoofdletters!)
   - **Value:** Plak je Resend API key (de hele key die je net gekopieerd hebt)
   - Klik **"Save"** of **"Add"**

4. Klik opnieuw op **"Add new secret"**

5. **Secret 2: RESEND_FROM_EMAIL**
   - **Name:** `RESEND_FROM_EMAIL` (exact deze naam, hoofdletters!)
   - **Value:** `noreply@bampro-uren.nl` (of je verified email in Resend)
   - **Let op:** Deze email moet geverifieerd zijn in Resend!
   - Klik **"Save"** of **"Add"**

6. **Secret 3 (Optioneel): APP_URL**
   - **Name:** `APP_URL`
   - **Value:** `https://bampro-uren.nl`
   - Klik **"Save"** of **"Add"**

## Stap 3: Re-deploy de Edge Function

**⚠️ BELANGRIJK:** Secrets worden alleen geladen bij deployment! Je moet de function opnieuw deployen.

1. Ga naar **Edge Functions** → **Functions**
2. Klik op **`send-reminder-email`**
3. Scroll naar beneden
4. Klik op **"Deploy"** of **"Redeploy"** knop
5. Wacht tot deployment klaar is (10-30 seconden)

## Stap 4: Test het

1. Ga naar je website → **Admin Panel** → **Reminders** tab
2. Selecteer 1 gebruiker (test eerst met jezelf!)
3. Voer weeknummer en jaar in
4. Klik **"Send Reminder"**
5. Je zou moeten zien:
   - ✅ "Reminders and emails sent successfully"
   - ✅ Check je email inbox (ook spam folder!)

## Troubleshooting

### Error: "RESEND_API_KEY secret is not configured"
- Check dat de secret naam exact is: `RESEND_API_KEY` (hoofdletters!)
- Check dat je de Edge Function opnieuw hebt gedeployed NA het toevoegen van secrets
- Ga naar **Edge Functions** → **Secrets** en check of `RESEND_API_KEY` er staat

### Error: "RESEND_FROM_EMAIL is not verified"
- Ga naar **Resend Dashboard** → **Domains**
- Check of `bampro-uren.nl` geverifieerd is
- Als niet, gebruik eerst: `noreply@onboarding.resend.dev` (test domain)
- Of verifieer je eigen domain eerst

### Geen email ontvangen?
- Check **spam/junk folder**
- Check **Resend Dashboard** → **Emails** voor delivery status
- Check **Supabase Dashboard** → **Edge Functions** → **send-reminder-email** → **Logs** voor errors

### Email gaat naar spam?
- Verifieer je eigen domain in Resend (niet de test domain)
- Voeg SPF/DKIM records toe aan je DNS (Resend geeft instructies)

## Checklist

- [ ] Resend API key gekopieerd (volledige key, begint met `re_...`)
- [ ] Secret `RESEND_API_KEY` toegevoegd in Supabase
- [ ] Secret `RESEND_FROM_EMAIL` toegevoegd in Supabase
- [ ] Edge Function `send-reminder-email` opnieuw gedeployed
- [ ] Test reminder verstuurd
- [ ] Email ontvangen (check ook spam!)

Als alles is aangevinkt, zou het moeten werken! 🎉

