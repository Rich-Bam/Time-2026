# Deploy Delete Request Edge Function - Stap voor Stap

## Probleem
Je ziet 404 errors voor OPTIONS requests en CORS errors. Dit betekent dat de edge function niet correct is gedeployed.

## Oplossing: Deploy de Edge Function

### Stap 1: Ga naar Supabase Dashboard

1. Open: https://supabase.com/dashboard
2. Log in met je account
3. Selecteer je project: `Timer-tracker-2026` (of je project naam)

### Stap 2: Ga naar Edge Functions

1. Klik in het **linker menu** op **"Edge Functions"** (bliksem icoon)
2. Klik op **"Functions"** (of je ziet direct een lijst)

### Stap 3: Check of `send-delete-request-email` bestaat

Kijk in de lijst:
- **Zie je `send-delete-request-email` in de lijst?**
  - **JA** → Ga naar Stap 4B
  - **NEE** → Ga naar Stap 4A

### Stap 4A: Maak de Edge Function aan (als die NIET bestaat)

1. Klik op **"Create new edge function"** of **"Deploy a new function"** (groene knop rechtsboven)
2. Er opent een popup of nieuwe pagina
3. **Function name:** Typ exact: `send-delete-request-email`
   - ⚠️ **BELANGRIJK:** 
     - Kleine letters
     - Met streepjes (niet underscore, niet spatie)
     - Exact zoals dit: `send-delete-request-email`
4. Klik op **"Create function"** of **"Create"**
5. Je ziet nu een code editor met wat voorbeeld code

### Stap 4B: Update de Edge Function (als die WEL bestaat)

1. Klik op **`send-delete-request-email`** in de lijst
2. Je ziet nu de code editor
3. Check of de code klopt (vergelijk met Stap 5)

### Stap 5: Kopieer de Code

1. Open het bestand in je project:
   - `supabase/functions/send-delete-request-email/index.ts`
   - Of open het in VS Code / je editor
2. **Selecteer ALLE code** (Ctrl + A / Cmd + A)
3. **Kopieer** de code (Ctrl + C / Cmd + C)

### Stap 6: Plak Code in Supabase

1. Ga terug naar Supabase Dashboard → Edge Functions → `send-delete-request-email`
2. **Selecteer ALLE code** in de Supabase editor (Ctrl + A / Cmd + A)
3. **Verwijder** de oude code (Delete)
4. **Plak** de nieuwe code (Ctrl + V / Cmd + V)
5. Check dat de code correct is geplakt (scroll door de code)

### Stap 7: Deploy de Function

1. Scroll naar beneden in de pagina
2. Zoek naar een knop die zegt:
   - **"Deploy"** OF
   - **"Redeploy"** OF
   - **"Save and Deploy"**
3. **Klik op deze knop**
4. Wacht een paar seconden - je ziet meestal:
   - Een loading indicator
   - Een melding "Deploying..." of "Redeploying..."
   - Daarna "Deployment successful" of een groene vink

**✅ SUCCES:** Als je een groene melding ziet, is de functie gedeployed!

### Stap 8: Verifieer Deployment

1. **Ga terug** naar de functies lijst (klik op "Functions" in de sidebar)
2. Zoek `send-delete-request-email` in de tabel
3. Kijk naar de **"UPDATED"** kolom
4. Dit zou nu moeten zeggen:
   - "just now" OF
   - "a few seconds ago" OF
   - "X minutes ago" (met een recente tijd)

Als de tijd recent is, is de functie succesvol gedeployed! ✅

### Stap 9: Configureer Secrets

1. Ga naar **Edge Functions** → **Settings** → **Secrets**
2. Check of deze secrets bestaan:
   - `RESEND_API_KEY` - Je Resend API key
   - `RESEND_FROM_EMAIL` - Verified email in Resend (bijv. `support@bampro-uren.nl`)
3. Als ze niet bestaan, voeg ze toe:
   - Klik op **"Add secret"**
   - Naam: `RESEND_API_KEY`, Waarde: je Resend API key
   - Klik op **"Add secret"** opnieuw
   - Naam: `RESEND_FROM_EMAIL`, Waarde: je verified email
4. **BELANGRIJK**: Na toevoegen van secrets, ga terug naar de function en klik op **"Redeploy"**

### Stap 10: Test de Function

1. Ga naar **Edge Functions** → **Functions** → `send-delete-request-email`
2. Klik op de **"Test"** tab (als beschikbaar)
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
5. Check de response - moet success zijn
6. Check de **"Logs"** tab - je zou logs moeten zien

## Troubleshooting

**Als je nog steeds 404 errors ziet:**
- Check function naam is exact `send-delete-request-email` (geen hoofdletters)
- Check function is gedeployed (status "Active")
- Re-deploy function opnieuw
- Wacht 10-30 seconden na deployment voordat je test

**Als CORS errors blijven:**
- Check edge function code heeft CORS headers (zou al moeten hebben)
- Check OPTIONS handler retourneert correct (zou al moeten zijn)
- Check function logs voor errors

**Als email niet wordt verstuurd:**
- Check `RESEND_API_KEY` secret is correct
- Check `RESEND_FROM_EMAIL` is verified in Resend
- Check edge function logs voor email errors
