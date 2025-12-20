# Debug: Geen Email Meer Na Wijziging

## Stap 1: Check Browser Console

1. Open je website
2. Druk op **F12** → **Console** tab
3. Probeer iemand uit te nodigen via Admin Panel
4. Kijk naar de console output:
   - Zie je `🔵 Edge Function response:`?
   - Wat staat er bij `data`?
   - Wat staat er bij `error`?
   - Kopieer de volledige output

## Stap 2: Check Supabase Edge Function Logs

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Klik op `invite-user`
3. Kijk naar recente logs:
   - Zie je requests binnenkomen?
   - Zie je errors?
   - Wat staat er in de logs?

**Belangrijk:** Deel de exacte error message die je ziet!

## Stap 3: Check of Edge Function is Gedeployed

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Klik op `invite-user`
3. Check of de code klopt:
   - Staat er `redirectTo: \`${appUrl}/invite-confirm\`` in de code?
   - Is de code compleet?
4. Als de code anders is:
   - Kopieer ALLE code uit: `supabase/functions/invite-user/index.ts`
   - Vervang de code in Supabase
   - Klik op **"Deploy function"**
   - Wacht tot deployment klaar is

## Stap 4: Test Direct in Supabase

1. Ga naar **Authentication** → **Users** → **Invite user**
2. Voer een test email in
3. Klik op **"Send invite"**
4. **Krijg je WEL een email?**
   - **JA** → Supabase email service werkt, probleem is met Edge Function
   - **NEE** → Supabase email service probleem (rate limit of configuratie)

## Stap 5: Check Email Rate Limits

Supabase heeft rate limits:
- **Gratis plan:** 3 emails/uur
- **Pro plan:** 4 emails/uur

**Oplossing:** Wacht een uur en probeer opnieuw.

## Stap 6: Check RedirectTo URL

Mogelijk accepteert Supabase de `/invite-confirm` URL niet. Probeer dit:

1. Ga naar **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Check of `https://bampro-uren.nl/invite-confirm` in de **Redirect URLs** lijst staat
3. Zo niet, voeg het toe:
   - Klik op **"Add URL"**
   - Voeg toe: `https://bampro-uren.nl/invite-confirm`
   - Klik op **"Save"**

## Stap 7: Tijdelijke Fix - Gebruik Homepage Redirect

Als `/invite-confirm` niet werkt, kunnen we tijdelijk terug naar homepage:

1. In Edge Function, verander:
   ```typescript
   redirectTo: `${appUrl}/invite-confirm`
   ```
   Naar:
   ```typescript
   redirectTo: `${appUrl}`
   ```

2. Deploy opnieuw
3. Test of emails nu worden verstuurd

## Wat te delen met mij

Deel:
1. Wat staat er in de browser console (F12)?
2. Wat staat er in Supabase Logs (Edge Functions → Logs → invite-user)?
3. Krijg je een email als je direct via Supabase Dashboard invite stuurt?
4. Is de Edge Function gedeployed (check Functions → invite-user)?





