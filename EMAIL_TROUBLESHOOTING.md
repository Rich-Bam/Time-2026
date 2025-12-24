# Email Troubleshooting Guide

Als je geen email ontvangt na het uitnodigen van een gebruiker, volg deze stappen:

## Stap 1: Check Browser Console

1. Open je website
2. Druk op **F12** (of rechtsklik → Inspect)
3. Ga naar **Console** tab
4. Nodig jezelf opnieuw uit
5. Kijk naar errors in de console

**Wat te zoeken:**
- `Edge Function failed` - De function is niet gedeployed of geeft een error
- `Failed to fetch` - De function URL is incorrect
- `401 Unauthorized` - Authentication probleem

## Stap 2: Check Supabase Edge Function Logs

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Klik op de `invite-user` function
3. Bekijk de logs voor errors

**Veelvoorkomende errors:**
- `Function not found` → Function is niet gedeployed
- `Missing SUPABASE_URL` → Environment variabelen probleem
- `Email already registered` → Email bestaat al in Supabase Auth

## Stap 3: Check of Edge Function Gedeployed is

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Check of `invite-user` in de lijst staat
3. Als het er niet is:
   - Klik op **"Create new edge function"**
   - Function name: `invite-user`
   - Kopieer code uit: `supabase/functions/invite-user/index.ts`
   - Klik **"Deploy function"**

## Stap 4: Check Supabase Email Service

1. Ga naar **Authentication** → **Email Templates**
2. Check of **"Invite user"** template actief is
3. Ga naar **Settings** → **Auth** → **SMTP Settings**
4. Check of email service is ingeschakeld

**Probleem:** Supabase's gratis email service heeft limieten:
- Max 3 emails per uur (gratis plan)
- Max 4 emails per uur (Pro plan)
- Emails kunnen in spam terechtkomen

## Stap 5: Check Spam Folder

- Check je **spam/junk** folder
- Check **promotions** tab (Gmail)
- Voeg `noreply@mail.app.supabase.io` toe aan je contacten

## Stap 6: Test Direct in Supabase

1. Ga naar **Authentication** → **Users**
2. Klik op **"Invite user"** (rechtsboven)
3. Voer je email in
4. Check of je email ontvangt

**Als dit werkt:** De Edge Function heeft een probleem
**Als dit niet werkt:** Supabase email service is niet geconfigureerd

## Stap 7: Check Email Limits

Supabase heeft rate limits:
- **Gratis plan:** 3 emails/uur
- **Pro plan:** 4 emails/uur

**Oplossing:** Wacht een uur en probeer opnieuw, of upgrade naar Pro plan.

## Stap 8: Alternative - Direct User Creation

Als emails niet werken, kun je gebruikers direct aanmaken:

1. In Admin Panel, voeg gebruiker toe
2. Als Edge Function faalt, wordt automatisch fallback gebruikt
3. Gebruiker wordt aangemaakt zonder email
4. Deel het wachtwoord handmatig met de gebruiker

## Stap 9: Enable Custom SMTP (Aanbevolen)

Voor betrouwbare emails, configureer custom SMTP:

1. Ga naar **Project Settings** → **Auth** → **SMTP Settings**
2. Schakel **"Enable Custom SMTP"** in
3. Vul SMTP gegevens in van je email provider

**Gmail SMTP:**
- Host: `smtp.gmail.com`
- Port: `587`
- Username: `jouw-email@gmail.com`
- Password: (App Password - zie Google Account settings)
- Sender email: `jouw-email@gmail.com`

## Stap 10: Check Edge Function Code

Als je de Edge Function via Dashboard hebt gedeployed, check:

1. Ga naar **Edge Functions** → **Functions** → **invite-user**
2. Check of de code correct is
3. Zorg dat `import { createClient }` aanwezig is
4. Zorg dat `Deno.serve` wordt gebruikt (niet `Deno.serve`)

## Snelle Fix: Direct User Creation

Als emails niet werken, gebruik deze workaround:

1. In Admin Panel, voeg gebruiker toe
2. Het systeem valt automatisch terug op direct user creation
3. De gebruiker krijgt een melding: "Gebruiker aangemaakt. Let op: er is geen email verstuurd."
4. Deel het wachtwoord handmatig met de gebruiker

## Contact

Als niets werkt:
1. Check Supabase status: https://status.supabase.com
2. Check Supabase logs voor meer details
3. Test met een ander email adres












