# Email Uitnodigingen Instellen

## Huidige Situatie

Er is al een Edge Function (`invite-user`) die emails verstuurt wanneer je nieuwe gebruikers uitnodigt. Deze moet wel eerst gedeployed zijn in Supabase.

## Stap 1: Deploy de Edge Function

### Optie A: Via Supabase Dashboard (Aanbevolen)

1. Ga naar **Supabase Dashboard** → **Edge Functions**
2. Klik **Create a new function**
3. Naam: `invite-user`
4. Kopieer de volledige inhoud van `supabase/functions/invite-user/index.ts`
5. Plak in de code editor
6. Klik **Deploy**

### Optie B: Via Supabase CLI

```bash
supabase functions deploy invite-user --project-ref YOUR_PROJECT_REF
```

## Stap 2: Configureer Supabase Email Service

1. Ga naar **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Controleer dat de **Invite User** template actief is
3. Optioneel: Pas de email template aan met je branding

## Stap 3: Configureer Redirect URL

1. Ga naar **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Zorg dat `https://bampro-uren.nl` (of je website URL) in de **Redirect URLs** lijst staat
3. Voeg ook toe: `https://bampro-uren.nl/invite-confirm`

## Stap 4: Test de Uitnodiging

1. Ga naar **Admin Panel** in je website
2. Klik **Add User**
3. Vul email en naam in
4. Klik **Add User**
5. Je zou een melding moeten zien: "Uitnodiging verstuurd"
6. Check de inbox van de gebruiker (en spam folder)

## Hoe Het Werkt

1. Admin klikt "Add User" in Admin Panel
2. Code roept de `invite-user` Edge Function aan
3. Edge Function gebruikt `supabase.auth.admin.inviteUserByEmail()` 
4. Supabase verstuurt automatisch een email met een invite link
5. Gebruiker klikt op de link in de email
6. Gebruiker wordt doorgestuurd naar `/invite-confirm` pagina
7. Gebruiker stelt zijn wachtwoord in
8. Gebruiker kan nu inloggen

## Troubleshooting

### Email wordt niet verstuurd

1. **Check of Edge Function gedeployed is:**
   - Ga naar **Edge Functions** → **invite-user**
   - Check of de function bestaat en actief is

2. **Check Supabase Email Service:**
   - Ga naar **Authentication** → **Email Templates**
   - Zorg dat emails enabled zijn
   - Check of er een SMTP provider is geconfigureerd (voor production)

3. **Check Console Logs:**
   - Open browser console (F12)
   - Kijk naar errors wanneer je "Add User" klikt
   - Check Edge Function logs in Supabase Dashboard

4. **Check Redirect URL:**
   - Zorg dat je website URL in Supabase's allowed redirect URLs staat
   - Ga naar **Authentication** → **URL Configuration**

### Edge Function Error 404

- De function is niet gedeployed
- Volg **Stap 1** hierboven om de function te deployen

### Edge Function Error 401/403

- Check of `VITE_SUPABASE_ANON_KEY` correct is in je environment variables
- Check of de anon key toegang heeft tot Edge Functions

### Email komt aan maar link werkt niet

- Check of de redirect URL correct is geconfigureerd
- Check of `/invite-confirm` route bestaat in je app (deze bestaat al)

## Belangrijk

- **Voor Development:** Supabase heeft een gratis email service die werkt voor testing
- **Voor Production:** Je moet mogelijk een SMTP provider configureren (SendGrid, Mailgun, etc.)
- **Email Templates:** Je kunt de email templates aanpassen in Supabase Dashboard

## Alternatief: Direct User Creation (Zonder Email)

Als de Edge Function niet werkt, wordt er automatisch een fallback gebruikt:
- Gebruiker wordt direct aangemaakt zonder email
- Admin moet het wachtwoord handmatig doorgeven aan de gebruiker
- Gebruiker kan direct inloggen met het wachtwoord

Dit is minder veilig, dus probeer de Edge Function te laten werken!






