# Email Uitnodigingen Troubleshooting

## Belangrijk: Eén uitnodigingsmail (geen dubbele link)

De uitnodiging moet via **één** mail gaan (onze Resend-mail met de activatielink). Als Supabase ook een invite-mail stuurt, kan de link "al gebruikt" lijken omdat de andere link de token al verbruikt heeft.

- **In de Edge Function** maken we nieuwe gebruikers aan met `createUser` + `generateLink` (geen `inviteUserByEmail`), zodat Supabase **geen** invite-mail stuurt. Alleen de Resend-mail wordt verstuurd.
- **Optioneel in Dashboard:** Ga naar **Authentication** → **Email Templates** → **Invite user**. Je kunt de template uitschakelen of leegmaken zodat Supabase nooit een invite-mail stuurt. Dan is er maar één link.

## Link verlooptijd (maximaliseren)

Standaard verloopt een activatielink na **24 uur**. Om gebruikers meer tijd te geven:

1. Ga naar **Supabase Dashboard** → **Authentication** → **Settings** (of **URL Configuration**).
2. Zoek naar **Magic link / Invite / OTP expiry** (of vergelijkbare instelling).
3. Zet de waarde op het **maximum** (bijv. 7 dagen / 168 uur als dat kan).
4. De e-mailtekst in de Edge Function zegt "valid for 7 days"; pas die tekst aan als je een andere verlooptijd kiest (bijv. 24 uur).

"Never expire" wordt door Supabase niet ondersteund; gebruik de maximale waarde die het dashboard toestaat.

---

## Stap 1: Check of Edge Function bestaat

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Zoek naar `invite-user` in de lijst
3. **Als de function NIET bestaat:**
   - Klik op **"Create new edge function"**
   - Function name: `invite-user`
   - Kopieer ALLE code uit: `supabase/functions/invite-user/index.ts`
   - Plak in de editor
   - Klik op **"Deploy function"**

## Stap 2: Check Browser Console

1. Open je website
2. Druk op **F12** om Developer Tools te openen
3. Ga naar **Console** tab
4. Probeer iemand uit te nodigen via Admin Panel
5. Kijk naar de console output:
   - Zie je `🔵 Calling Edge Function:`?
   - Zie je `🔵 Edge Function response status:`?
   - Welke status code zie je? (404, 401, 500, etc.)

## Stap 3: Check Supabase Logs

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Klik op `invite-user` (als die bestaat)
3. Kijk naar recente logs:
   - Zie je errors?
   - Zie je welke requests er binnenkomen?

## Stap 4: Check Edge Function Secrets

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Check of deze secrets bestaan:
   - `SUPABASE_URL` - **Automatisch beschikbaar, hoef je NIET toe te voegen**
   - `SUPABASE_SERVICE_ROLE_KEY` - **Automatisch beschikbaar, hoef je NIET toe te voegen**
   - `APP_URL` - **Optioneel, maar aanbevolen** (zet op `https://bampro-uren.nl`)

## Stap 5: Check Supabase Email Service

1. Ga naar **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Check of de **Invite user** template bestaat
3. Test direct in Supabase:
   - Ga naar **Authentication** → **Users** → **Invite user**
   - Voer een test email in
   - Klik op **Send invite**
   - **Krijg je WEL een email?** → Dan werkt Supabase email service, het probleem is de Edge Function
   - **Krijg je GEEN email?** → Dan is Supabase email service niet geconfigureerd

## Stap 6: Check Email Link

Als je WEL een email krijgt:
- **Gaat de link naar `localhost:3000`?** → Voeg `APP_URL` secret toe (Stap 4)
- **Gaat de link naar `https://bampro-uren.nl`?** → Perfect!

## Veelvoorkomende Problemen

### Probleem 1: "Edge Function niet gevonden (404)"
**Oplossing:** De Edge Function is niet gedeployed. Volg Stap 1.

### Probleem 2: "Toegang geweigerd (401/403)"
**Oplossing:** 
- Check of `VITE_SUPABASE_ANON_KEY` correct is in Netlify environment variables
- Check of de Edge Function correct is gedeployed

### Probleem 3: "Email al geregistreerd"
**Oplossing:**
- Ga naar **Authentication** → **Users**
- Verwijder de bestaande user
- Probeer opnieuw

### Probleem 4: "Geen email ontvangen"
**Mogelijke oorzaken:**
1. **Spam folder** - Check je spam/junk folder
2. **Supabase email service niet geconfigureerd** - Check Stap 5
3. **Edge Function werkt niet** - Check Stap 1 en Stap 3
4. **Email provider blokkeert Supabase emails** - Sommige email providers blokkeren Supabase

### Probleem 5: Email link gaat naar localhost
**Oplossing:**
- Voeg `APP_URL` secret toe in Edge Functions → Secrets
- Value: `https://bampro-uren.nl`

## Test Checklist

- [ ] Edge Function `invite-user` bestaat in Supabase
- [ ] Edge Function is gedeployed (niet alleen aangemaakt)
- [ ] Browser console toont geen 404 errors
- [ ] Supabase logs tonen geen errors
- [ ] `APP_URL` secret is ingesteld (optioneel maar aanbevolen)
- [ ] Alleen Resend stuurt de invite-mail (geen tweede mail van Supabase)
- [ ] Invite/link expiry in Auth-instellingen op maximum gezet (bijv. 7 dagen)
- [ ] Email komt aan (check spam folder)
- [ ] Email link gaat naar juiste URL (niet localhost)
- [ ] Klik op "Account activeren" werkt; link toont niet "al gebruikt" of "verlopen"

## Snelle Test

1. Open browser console (F12)
2. Probeer iemand uit te nodigen
3. Kijk naar console output
4. Deel de output met mij zodat ik kan helpen!


















