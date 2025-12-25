# Snel: Email Uitnodigingen Activeren

## ✅ Wat Er Al Is

Er is al een Edge Function (`invite-user`) die emails verstuurt! Je hoeft alleen te controleren of deze gedeployed is.

## 🚀 Stap 1: Check of Edge Function Gedeployed Is

1. Ga naar **Supabase Dashboard** → **Edge Functions**
2. Kijk of `invite-user` in de lijst staat
3. **Als het er NIET is:** Volg de stappen hieronder
4. **Als het er WEL is:** Ga naar Stap 2

### Edge Function Deployen (Als het er niet is)

1. Klik **Create a new function**
2. Naam: `invite-user`
3. Kopieer ALLE code uit `supabase/functions/invite-user/index.ts`
4. Plak in de editor
5. Klik **Deploy**

## 🔧 Stap 2: Configureer Redirect URL

1. Ga naar **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Zorg dat deze URLs in **Redirect URLs** staan:
   - `https://bampro-uren.nl`
   - `https://bampro-uren.nl/invite-confirm`
   - `https://bampro-uren.nl/reset`
3. Klik **Save**

## 📧 Stap 3: Test Email Service

1. Ga naar **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Check of de **Invite User** template actief is
3. Voor development: Supabase's gratis email service werkt automatisch
4. Voor production: Mogelijk SMTP provider nodig (SendGrid, Mailgun, etc.)

## ✅ Stap 4: Test Uitnodiging

1. Ga naar je website → **Admin Panel**
2. Klik **Add User**
3. Vul email en naam in
4. Klik **Add User**
5. Je zou moeten zien: **"Uitnodiging verstuurd"**
6. Check de inbox van de gebruiker (en spam folder)

## ❌ Als Email Niet Wordt Verstuurd

### Check 1: Edge Function bestaat?
- Ga naar **Edge Functions** → Check of `invite-user` bestaat
- Als niet: Deploy de function (zie Stap 1)

### Check 2: Console Errors?
- Open browser console (F12)
- Klik "Add User" en kijk naar errors
- Check Edge Function logs in Supabase Dashboard

### Check 3: Redirect URL?
- Check of `https://bampro-uren.nl/invite-confirm` in allowed URLs staat
- Ga naar **Authentication** → **URL Configuration**

### Check 4: Email Service?
- Ga naar **Authentication** → **Email Templates**
- Check of emails enabled zijn
- Voor production: Mogelijk SMTP provider nodig

## 📝 Wat Gebeurt Er Nu?

1. Admin klikt "Add User" → Code roept Edge Function aan
2. Edge Function verstuurt email via Supabase
3. Gebruiker krijgt email met invite link
4. Gebruiker klikt link → gaat naar `/invite-confirm`
5. Gebruiker stelt wachtwoord in
6. Gebruiker kan inloggen

## ⚠️ Fallback

Als de Edge Function niet werkt, wordt er automatisch een fallback gebruikt:
- Gebruiker wordt direct aangemaakt (zonder email)
- Admin moet wachtwoord handmatig doorgeven
- Minder veilig, maar werkt wel

**Aanbevolen:** Laat de Edge Function werken voor automatische emails!











