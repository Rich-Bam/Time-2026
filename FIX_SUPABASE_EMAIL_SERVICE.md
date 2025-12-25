# Fix: Supabase Email Service Werkt Niet

Als zelfs direct uitnodigen vanuit Supabase Dashboard niet werkt, is het probleem met de Supabase email service zelf.

## Stap 1: Check Email Rate Limits

Supabase heeft strikte rate limits:
- **Gratis plan:** Max 3 emails per uur
- **Pro plan:** Max 4 emails per uur

**Check:**
1. Ga naar **Supabase Dashboard** → **Project Settings** → **Usage**
2. Kijk naar **Email** usage
3. **Heb je de limiet bereikt?**
   - **JA** → Wacht 1 uur en probeer opnieuw
   - **NEE** → Ga naar Stap 2

## Stap 2: Check Spam Folder

1. Check je **spam/junk** folder
2. Check **promotions** tab (Gmail)
3. Zoek naar emails van `noreply@mail.app.supabase.io`
4. **Krijg je emails in spam?**
   - **JA** → Voeg `noreply@mail.app.supabase.io` toe aan je contacten
   - **NEE** → Ga naar Stap 3

## Stap 3: Check Email Service Status

1. Ga naar **Supabase Dashboard** → **Authentication** → **Settings**
2. Scroll naar **Email Auth**
3. Check of **"Enable Email Auth"** is ingeschakeld
4. **Is het uitgeschakeld?**
   - **JA** → Schakel het in en probeer opnieuw
   - **NEE** → Ga naar Stap 4

## Stap 4: Check SMTP Settings

1. Ga naar **Supabase Dashboard** → **Project Settings** → **Auth** → **SMTP Settings**
2. Check of **"Enable Custom SMTP"** is ingeschakeld
3. **Is Custom SMTP ingeschakeld maar niet geconfigureerd?**
   - **JA** → Dit kan het probleem zijn! Schakel Custom SMTP uit OF configureer het correct
4. **Is Custom SMTP uitgeschakeld?**
   - **JA** → Supabase gebruikt standaard email service (kan rate limits hebben)

## Stap 5: Enable Custom SMTP (Aanbevolen)

Voor betrouwbare emails, configureer custom SMTP:

### Optie A: Gmail SMTP

1. Ga naar **Project Settings** → **Auth** → **SMTP Settings**
2. Schakel **"Enable Custom SMTP"** in
3. Vul in:
   - **Host:** `smtp.gmail.com`
   - **Port:** `587`
   - **Username:** `jouw-email@gmail.com`
   - **Password:** (App Password - zie hieronder)
   - **Sender email:** `jouw-email@gmail.com`
   - **Sender name:** `BAMPRO MARINE`

4. **Gmail App Password aanmaken:**
   - Ga naar Google Account → Security
   - Schakel 2-Step Verification in (als nog niet gedaan)
   - Ga naar App Passwords
   - Maak een nieuwe App Password aan voor "Mail"
   - Gebruik dit wachtwoord in Supabase (16 tekens, geen spaties)

5. Klik op **"Save"**

### Optie B: Andere Email Provider

Voor andere providers (bijv. Outlook, SendGrid, etc.):
- Check de SMTP settings van je provider
- Vul de juiste host, port, en credentials in

## Stap 6: Test Email Service

1. Ga naar **Authentication** → **Users** → **Invite user**
2. Voer een test email in (gebruik een email die je direct kunt checken)
3. Klik op **"Send invite"**
4. **Krijg je nu een email?**
   - **JA** → Email service werkt! Test nu via Admin Panel
   - **NEE** → Ga naar Stap 7

## Stap 7: Check Supabase Status

1. Ga naar: https://status.supabase.com
2. Check of er problemen zijn met:
   - Email service
   - Authentication service
3. **Zijn er problemen?**
   - **JA** → Wacht tot Supabase het heeft opgelost
   - **NEE** → Ga naar Stap 8

## Stap 8: Check Email Template

1. Ga naar **Authentication** → **Email Templates**
2. Klik op **"Invite user"** template
3. Check of de template correct is:
   - Staat er `{{ .ConfirmationURL }}` in de template?
   - Is de template niet leeg?
4. **Is de template leeg of incorrect?**
   - **JA** → Herstel de template (zie `FIX_EMAIL_URL_AND_BRANDING.md`)
   - **NEE** → Ga naar Stap 9

## Stap 9: Check Project Settings

1. Ga naar **Project Settings** → **General**
2. Check of je project niet is **paused** of **suspended**
3. Check of je **billing** in orde is
4. **Is er een probleem?**
   - **JA** → Los het op (bijv. upgrade plan, betaal rekening)
   - **NEE** → Ga naar Stap 10

## Stap 10: Contact Supabase Support

Als niets werkt:
1. Ga naar **Supabase Dashboard** → **Support**
2. Maak een support ticket aan
3. Beschrijf het probleem:
   - "Email invitations not being sent"
   - "Even direct from Dashboard doesn't work"
   - "No errors in logs"
   - "Email service appears to be down"

## Snelle Checklist

- [ ] Email rate limit niet bereikt
- [ ] Spam folder gecheckt
- [ ] Email Auth is ingeschakeld
- [ ] Custom SMTP correct geconfigureerd (of uitgeschakeld)
- [ ] Email template is correct
- [ ] Project is niet paused
- [ ] Supabase status is OK
- [ ] Test email vanuit Dashboard werkt

## Alternatieve Oplossing: Direct User Creation

Als emails echt niet werken, kun je gebruikers direct aanmaken:

1. In Admin Panel, voeg gebruiker toe
2. Het systeem valt automatisch terug op direct user creation
3. De gebruiker krijgt een melding: "Gebruiker aangemaakt. Let op: er is geen email verstuurd."
4. Deel het wachtwoord handmatig met de gebruiker
5. Gebruiker kan direct inloggen

## Meest Waarschijnlijke Oorzaken

1. **Email rate limit bereikt** (90% van de gevallen)
2. **Custom SMTP verkeerd geconfigureerd** (5% van de gevallen)
3. **Email gaat naar spam** (3% van de gevallen)
4. **Supabase email service down** (2% van de gevallen)

## Wat te delen met mij

Deel:
1. Welke stap heb je gecheckt?
2. Wat zie je in Supabase Dashboard → Usage → Email?
3. Is Custom SMTP ingeschakeld?
4. Krijg je errors in Supabase Dashboard?












