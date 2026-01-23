# Complete Setup: Delete Request Systeem

Dit document bevat alle stappen om het delete request systeem volledig werkend te krijgen.

## Overzicht

Het delete request systeem bestaat uit:
1. Database tabel `delete_requests` voor het opslaan van verzoeken
2. Edge function `send-delete-request-email` voor het versturen van emails
3. Real-time notifications voor super admin
4. UI in AdminPanel voor het beheren van requests

## Stap 1: Database Tabel Aanmaken

1. Ga naar **Supabase Dashboard** → **SQL Editor**
2. Open het bestand `create_delete_requests_table.sql`
3. Kopieer **ALLE** code
4. Plak in de SQL Editor
5. Klik op **"Run"**
6. Controleer of er geen errors zijn

**Verificatie:**
- Run `verify_delete_requests_table.sql` om te checken of alles correct is
- Je zou moeten zien: tabel bestaat, RLS enabled, 5 policies, 5 indexes

## Stap 2: Edge Function Deployen

1. Volg de stappen in `DEPLOY_DELETE_REQUEST_FUNCTION.md`
2. Belangrijk: Function naam moet exact `send-delete-request-email` zijn
3. Na deployment, check "UPDATED" tijd is recent

**Verificatie:**
- Function staat in lijst met status "Active"
- "UPDATED" tijd is "just now" of recent
- Code in editor matcht lokale code

## Stap 3: Secrets Configureren

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets**
2. Voeg toe (als niet bestaat):
   - `RESEND_API_KEY` - Je Resend API key
   - `RESEND_FROM_EMAIL` - Verified email in Resend (bijv. `support@bampro-uren.nl`)
3. **BELANGRIJK**: Na toevoegen van secrets, re-deploy de function

**Verificatie:**
- Secrets staan in de lijst
- Ze hebben waarden (niet leeg)

## Stap 4: Real-time Replication Inschakelen

1. Ga naar **Supabase Dashboard** → **SQL Editor**
2. Open het bestand `enable_realtime_delete_requests.sql`
3. Kopieer **ALLE** code
4. Plak in de SQL Editor
5. Klik op **"Run"**
6. Controleer of er geen errors zijn

**Alternatief via Dashboard:**
1. Ga naar **Supabase Dashboard** → **Database** → **Replication**
2. Zoek naar `delete_requests` in de lijst
3. Als niet gevonden: Enable replication voor deze tabel

**Verificatie:**
- Run de verificatie query in `enable_realtime_delete_requests.sql`
- Je zou moeten zien: "Real-time replication ENABLED"

## Stap 5: Test de Edge Function

### Test vanuit Supabase Dashboard

1. Ga naar **Edge Functions** → **Functions** → `send-delete-request-email`
2. Klik op de **"Test"** tab
3. Gebruik dit test body:
```json
{
  "deleteRequestId": "test-123",
  "requestedUserEmail": "test@example.com",
  "requestedUserName": "Test User",
  "requestedByEmail": "admin@example.com",
  "requestedByName": "Admin User"
}
```
4. Klik **"Run"** of **"Test"**
5. Check response - moet success zijn
6. Check **"Logs"** tab - je zou logs moeten zien

### Test vanuit Applicatie

1. Refresh website (hard refresh: Ctrl+Shift+R of Cmd+Shift+R)
2. Log in als **administratie-gebruiker**
3. Ga naar **Beheer** → **Gebruikers** tab
4. Klik op **"Verwijderen"** bij een gebruiker
5. Check browser console (F12) - **geen CORS errors**
6. Check Supabase logs - moet logs tonen

## Stap 6: Test Volledige Flow

### Test Scenario 1: Administratie User maakt Request

1. Log in als **administratie-gebruiker**
2. Ga naar **Beheer** → **Gebruikers**
3. Klik op **"Verwijderen"** bij een gebruiker
4. Je zou moeten zien:
   - ✅ Toast: "Verzoek ingediend"
   - ✅ Geen CORS errors in console
   - ✅ Request wordt opgeslagen in database

### Test Scenario 2: Super Admin krijgt Notificatie

1. Log in als **super admin** (in andere browser/tab)
2. Je zou moeten zien:
   - ✅ Toast notification: "Nieuw Verwijderverzoek"
   - ✅ Email in inbox (check spam folder)
3. Ga naar **Beheer** → **Verwijderverzoeken** tab
4. Je zou moeten zien:
   - ✅ Delete request in de lijst
   - ✅ Details van gebruiker en wie het verzoek heeft ingediend

### Test Scenario 3: Super Admin keurt Request goed

1. Als super admin, klik op **"Goedkeuren en Verwijderen"**
2. Je zou moeten zien:
   - ✅ Gebruiker is verwijderd
   - ✅ Request status is "approved"
   - ✅ Toast: "Verzoek goedgekeurd"

### Test Scenario 4: Super Admin wijst Request af

1. Als super admin, klik op **"Afwijzen"**
2. Je zou moeten zien:
   - ✅ Request status is "rejected"
   - ✅ Gebruiker is NIET verwijderd
   - ✅ Toast: "Verzoek afgewezen"

## Troubleshooting

### 404 Errors blijven

**Oplossing:**
1. Check function naam is exact `send-delete-request-email` (geen hoofdletters, geen underscores)
2. Check function is gedeployed (status "Active" in lijst)
3. Re-deploy function opnieuw
4. Wacht 10-30 seconden na deployment
5. Hard refresh website (Ctrl+Shift+R)

### CORS Errors blijven

**Oplossing:**
1. Check edge function code heeft CORS headers (zou al moeten hebben)
2. Check OPTIONS handler retourneert correct (regel 35-37 in index.ts)
3. Check function logs voor errors
4. Re-deploy function opnieuw

### Email niet verstuurd

**Oplossing:**
1. Check `RESEND_API_KEY` secret is correct en heeft waarde
2. Check `RESEND_FROM_EMAIL` is verified in Resend dashboard
3. Check edge function logs voor email errors
4. Test email direct vanuit Resend dashboard

### Real-time Notificatie werkt niet

**Oplossing:**
1. Check replication is enabled voor `delete_requests` tabel (run `enable_realtime_delete_requests.sql`)
2. Check super admin is ingelogd (subscription werkt alleen voor super admin)
3. Check browser console voor subscription errors
4. Check Supabase Dashboard → Database → Replication → `delete_requests` staat in lijst

### Geen logs in Edge Function

**Oplossing:**
1. Check function is gedeployed (status "Active")
2. Check "UPDATED" tijd is recent
3. Test function vanuit Supabase Dashboard Test tab
4. Check of je in de juiste environment kijkt (PRODUCTION vs DEVELOPMENT)

## Verificatie Checklist

Gebruik deze checklist om te verifiëren dat alles werkt:

- [ ] Database tabel `delete_requests` bestaat (run `verify_delete_requests_table.sql`)
- [ ] RLS is enabled voor `delete_requests` tabel
- [ ] 5 RLS policies zijn aangemaakt (INSERT, SELECT x2, UPDATE, DELETE)
- [ ] 5 indexes zijn aangemaakt
- [ ] Edge function `send-delete-request-email` bestaat en is gedeployed
- [ ] Edge function "UPDATED" tijd is recent
- [ ] Edge function secrets zijn ingesteld (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- [ ] Real-time replication is enabled voor `delete_requests` tabel
- [ ] Edge function test vanuit dashboard werkt
- [ ] Geen CORS errors in browser console
- [ ] Delete request wordt opgeslagen in database
- [ ] Email wordt verstuurd naar super admin
- [ ] Real-time notification verschijnt voor super admin
- [ ] Super admin kan request goedkeuren/afwijzen

## Belangrijke Bestanden

- `create_delete_requests_table.sql` - Maakt database tabel aan
- `verify_delete_requests_table.sql` - Verifieert tabel setup
- `enable_realtime_delete_requests.sql` - Schakelt real-time in
- `DEPLOY_DELETE_REQUEST_FUNCTION.md` - Deployment guide
- `supabase/functions/send-delete-request-email/index.ts` - Edge function code

## Support

Als je na het volgen van alle stappen nog steeds problemen hebt:
1. Check alle verificatie scripts
2. Check edge function logs in Supabase Dashboard
3. Check browser console voor errors
4. Deel de specifieke error messages
