# Password Reset Email Setup

## Probleem
Password reset emails worden niet verstuurd omdat gebruikers die direct in de `users` tabel zijn aangemaakt (via Admin Panel) niet in Supabase Auth bestaan. De `supabase.auth.resetPasswordForEmail()` functie werkt alleen voor gebruikers die in Supabase Auth zitten.

## Oplossing
Er is een Edge Function gemaakt (`password-reset`) die:
1. Controleert of de gebruiker in de `users` tabel bestaat
2. Als de gebruiker niet in Supabase Auth bestaat, wordt deze eerst aangemaakt
3. Genereert een password reset link
4. Verstuurt automatisch een email via Supabase's email service

## Stap 1: Deploy de Edge Function

1. Ga naar **Supabase Dashboard** → **Edge Functions**
2. Klik op **"Create a new function"**
3. Naam: `password-reset`
4. Kopieer ALLE code uit `supabase/functions/password-reset/index.ts`
5. Plak in de editor
6. Klik op **"Deploy"**

## Stap 2: Configureer Redirect URL

1. Ga naar **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Zorg dat deze URL in **Redirect URLs** staat:
   - `https://bampro-uren.nl/reset`
   - `http://localhost:8080/reset` (voor development)
3. Klik op **"Save"**

## Stap 3: Test Password Reset

1. Ga naar de login pagina
2. Klik op **"Forgot Password?"**
3. Voer een email adres in van een gebruiker die in de `users` tabel bestaat
4. Klik op **"Verstuur Reset Link"**
5. Je zou moeten zien: **"Password reset email is verstuurd!"**
6. Check de inbox van de gebruiker (en spam folder)

## Hoe het werkt

1. **Gebruiker bestaat in Auth:**
   - Edge Function genereert direct een password reset link
   - Email wordt automatisch verstuurd via Supabase

2. **Gebruiker bestaat NIET in Auth:**
   - Edge Function maakt eerst de gebruiker aan in Supabase Auth
   - Genereert dan een password reset link
   - Email wordt automatisch verstuurd

## Troubleshooting

### Email wordt niet verstuurd

1. **Check Edge Function:**
   - Ga naar **Edge Functions** → **password-reset**
   - Check of de function gedeployed is
   - Kijk naar de logs voor errors

2. **Check Email Service:**
   - Ga naar **Authentication** → **Email Templates**
   - Check of de **"Reset Password"** template actief is
   - Check of Supabase email service werkt (zie `FIX_SUPABASE_EMAIL_SERVICE.md`)

3. **Check Rate Limits:**
   - Supabase heeft rate limits: 3-4 emails per uur (gratis plan)
   - Check **Project Settings** → **Usage** → **Email**

4. **Check Redirect URL:**
   - Zorg dat `https://bampro-uren.nl/reset` in allowed URLs staat
   - Ga naar **Authentication** → **URL Configuration**

### Edge Function geeft error

1. **Check Console:**
   - Open browser console (F12)
   - Kijk naar errors wanneer je "Verstuur Reset Link" klikt

2. **Check Edge Function Logs:**
   - Ga naar **Edge Functions** → **password-reset** → **Logs**
   - Kijk naar error messages

3. **Check of Function bestaat:**
   - Ga naar **Edge Functions**
   - Check of `password-reset` in de lijst staat
   - Als niet: Deploy de function (zie Stap 1)

## Alternatieve Oplossing (Als Edge Function niet werkt)

Als de Edge Function niet werkt, kunnen admins handmatig wachtwoorden resetten:

1. Ga naar **Admin Panel**
2. Zoek de gebruiker in de lijst
3. Klik op **"Reset Password"**
4. Voer een nieuw wachtwoord in
5. Klik op **"Save"**
6. Deel het nieuwe wachtwoord met de gebruiker

## Belangrijke Notities

- De Edge Function gebruikt Supabase's ingebouwde email service
- Geen extra SMTP configuratie nodig (tenzij je custom SMTP wilt gebruiken)
- Emails kunnen naar spam folder gaan - check dit altijd
- Rate limits kunnen voorkomen dat emails worden verstuurd (wacht 1 uur en probeer opnieuw)

