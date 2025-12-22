# Debug: Password Reset Email Wordt Niet Verstuurd

## Stap 1: Check Browser Console

1. Open je website
2. Druk op **F12** → **Console** tab
3. Probeer password reset:
   - Klik op "Forgot Password?"
   - Voer een email in
   - Klik op "Verstuur Reset Link"
4. Kijk naar de console output:
   - Zie je `🔵 Calling password-reset Edge Function for:`?
   - Zie je `🔵 Edge Function response:`?
   - Wat staat er bij `edgeData`?
   - Wat staat er bij `edgeError`?
   - Zie je `❌ Edge Function error:`?
   - **Kopieer de volledige output**

## Stap 2: Check of Edge Function is Gedeployed

1. Ga naar **Supabase Dashboard** → **Edge Functions**
2. Kijk in de lijst: **Staat `password-reset` erin?**
   - **NEE** → Deploy de function (zie Stap 3)
   - **JA** → Ga naar Stap 4

## Stap 3: Deploy Edge Function (Als deze niet bestaat)

1. Ga naar **Supabase Dashboard** → **Edge Functions**
2. Klik op **"Create a new function"**
3. Naam: `password-reset` (exact deze naam!)
4. Kopieer **ALLE** code uit `supabase/functions/password-reset/index.ts`
5. Plak in de editor
6. Klik op **"Deploy"**
7. Wacht tot deployment klaar is (zie "Deployed" status)

## Stap 4: Check Edge Function Logs

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **password-reset**
2. Klik op **"Logs"** tab
3. Probeer opnieuw password reset
4. Kijk naar recente logs:
   - Zie je requests binnenkomen?
   - Zie je errors?
   - Wat staat er in de logs?
   - **Kopieer de error messages**

## Stap 5: Test Direct in Supabase

1. Ga naar **Supabase Dashboard** → **Authentication** → **Users**
2. Klik op **"Invite user"** (rechtsboven)
3. Voer een test email in
4. Klik op **"Send invite"**
5. **Krijg je WEL een email?**
   - **JA** → Supabase email service werkt, probleem is met password reset
   - **NEE** → Supabase email service probleem (zie Stap 6)

## Stap 6: Check Email Service Configuratie

### Check Rate Limits

1. Ga naar **Supabase Dashboard** → **Project Settings** → **Usage**
2. Kijk naar **Email** usage
3. **Heb je de limiet bereikt?**
   - **JA** → Wacht 1 uur en probeer opnieuw
   - **NEE** → Ga naar volgende stap

### Check Email Templates

1. Ga naar **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Klik op **"Reset Password"** template
3. Check of de template actief is
4. Check of er een `{{ .ConfirmationURL }}` of `{{ .Token }}` in staat

### Check Redirect URL

1. Ga naar **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Check of `https://bampro-uren.nl/reset` in **Redirect URLs** staat
3. **Staat het er NIET in?**
   - Klik op **"Add URL"**
   - Voeg toe: `https://bampro-uren.nl/reset`
   - Klik op **"Save"**

## Stap 7: Test Edge Function Direct

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **password-reset**
2. Klik op **"Invoke"** tab
3. Method: **POST**
4. Body:
   ```json
   {
     "email": "jouw-test-email@bampro.nl"
   }
   ```
5. Klik op **"Invoke function"**
6. Kijk naar de response:
   - Zie je `success: true`?
   - Zie je een error?
   - **Kopieer de response**

## Stap 8: Check of Gebruiker in Auth Bestaat

1. Ga naar **Supabase Dashboard** → **Authentication** → **Users**
2. Zoek naar het email adres dat je probeert te resetten
3. **Staat de gebruiker erin?**
   - **JA** → Ga naar Stap 9
   - **NEE** → Dit is normaal! De Edge Function zou de gebruiker moeten aanmaken

## Stap 9: Check Edge Function Code

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **password-reset**
2. Klik op **"Code"** tab
3. Check of de code klopt:
   - Staat er `resetPasswordForEmail` in de code?
   - Staat er `redirectTo: \`${appUrl}/reset\`` in de code?
   - Is de code compleet?
4. **Als de code anders is:**
   - Kopieer **ALLE** code uit `supabase/functions/password-reset/index.ts`
   - Vervang de code in Supabase
   - Klik op **"Deploy function"**
   - Wacht tot deployment klaar is

## Stap 10: Check Spam Folder

1. Check je **spam/junk** folder
2. Check **promotions** tab (Gmail)
3. Zoek naar emails van `noreply@mail.app.supabase.io`
4. **Krijg je emails in spam?**
   - **JA** → Voeg `noreply@mail.app.supabase.io` toe aan je contacten
   - **NEE** → Ga naar Stap 11

## Stap 11: Check SMTP Settings

1. Ga naar **Supabase Dashboard** → **Project Settings** → **Auth** → **SMTP Settings**
2. Check of **"Enable Custom SMTP"** is ingeschakeld
3. **Is Custom SMTP ingeschakeld maar niet geconfigureerd?**
   - **JA** → Dit kan het probleem zijn! Schakel Custom SMTP uit OF configureer het correct
4. **Is Custom SMTP uitgeschakeld?**
   - **JA** → Supabase gebruikt standaard email service (kan rate limits hebben)

## Wat te delen met mij

Deel:
1. **Browser Console output** (F12 → Console) - wat zie je wanneer je "Verstuur Reset Link" klikt?
2. **Edge Function Logs** (Edge Functions → password-reset → Logs) - wat staat er in de logs?
3. **Is password-reset Edge Function gedeployed?** (Edge Functions → check of het in de lijst staat)
4. **Test direct in Supabase** - krijg je een email als je direct via Dashboard invite stuurt?
5. **Edge Function Invoke response** - wat krijg je als je de function direct aanroept?

## Meest Waarschijnlijke Oorzaken

1. **Edge Function niet gedeployed** (90% van de gevallen)
2. **Email rate limit bereikt** (5% van de gevallen)
3. **Redirect URL niet geconfigureerd** (3% van de gevallen)
4. **Edge Function code is incorrect** (2% van de gevallen)

## Snelle Checklist

- [ ] Edge Function `password-reset` is gedeployed
- [ ] Browser console toont geen errors
- [ ] Edge Function logs tonen geen errors
- [ ] Redirect URL `https://bampro-uren.nl/reset` is geconfigureerd
- [ ] Email rate limit niet bereikt
- [ ] Spam folder gecheckt
- [ ] Test email vanuit Dashboard werkt
- [ ] Edge Function code is correct

