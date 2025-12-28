# Debug Edge Function - Stap voor Stap

Als je de fout ziet: **"Failed to send a request to the Edge Function"**, volg deze stappen:

## Stap 1: Check Edge Function Logs

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Klik op **`send-reminder-email`**
3. Klik op de **"Logs"** tab (of "View logs")
4. Kijk naar de meest recente logs
5. **Wat zie je?**
   - ❌ Error messages? → Noteer de exacte error
   - ❌ Geen logs? → De function wordt niet aangeroepen
   - ✅ Logs maar geen errors? → Check de response

## Stap 2: Test de Edge Function Direct

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions** → **`send-reminder-email`**
2. Klik op **"Invoke"** of **"Test"** knop (als beschikbaar)
3. Of gebruik de browser console:

```javascript
// Test in browser console (op je website)
const testPayload = {
  userIds: ["jouw-user-id"], // Vervang met een echte user ID
  weekNumber: 51,
  year: 2025,
  message: "Test reminder"
};

const { data, error } = await supabase.functions.invoke('send-reminder-email', {
  body: testPayload
});

console.log("Response:", data);
console.log("Error:", error);
```

## Stap 3: Check Secrets

1. Ga naar **Edge Functions** → **Secrets**
2. Check of deze secrets bestaan:
   - ✅ `RESEND_API_KEY` (moet een waarde hebben)
   - ✅ `RESEND_FROM_EMAIL` (moet een waarde hebben)
3. **Als secrets ontbreken:**
   - Voeg ze toe (zie `ADD_RESEND_SECRETS.md`)
   - **Re-deploy de function** (belangrijk!)

## Stap 4: Re-deploy de Edge Function

**⚠️ BELANGRIJK:** Na het toevoegen van secrets of het wijzigen van code, moet je de function opnieuw deployen!

1. Ga naar **Edge Functions** → **Functions** → **`send-reminder-email`**
2. Scroll naar beneden
3. Klik op **"Deploy"** of **"Redeploy"**
4. Wacht tot deployment klaar is
5. Check de **"UPDATED"** tijd - moet "just now" zijn

## Stap 5: Check de Code

Als je de code handmatig hebt aangepast, check:

1. **Syntax errors?**
   - Ga naar **Edge Functions** → **Functions** → **`send-reminder-email`**
   - Kijk of er rode onderstrepingen zijn
   - Check of de code correct is geformatteerd

2. **Email adres correct?**
   - Moet een geverifieerd email adres zijn in Resend
   - Check **Resend Dashboard** → **Domains** → of `bampro-uren.nl` geverifieerd is
   - Of gebruik `support@bampro-uren.nl` als die geverifieerd is

## Stap 6: Check Network Request

1. Open **Browser Developer Tools** (F12)
2. Ga naar **Network** tab
3. Verstuur een reminder
4. Klik op de `send-reminder-email` request
5. Check:
   - **Status code:** Moet 200 zijn (niet 404, 500, etc.)
   - **Request payload:** Check of `userIds`, `weekNumber`, `year` correct zijn
   - **Response:** Wat staat er in de response?

## Veelvoorkomende Problemen

### Probleem: "Failed to load response data"
**Oorzaak:** Edge Function crasht voordat het een response kan sturen
**Oplossing:**
- Check Edge Function logs voor errors
- Check of alle secrets correct zijn ingesteld
- Re-deploy de function

### Probleem: "404 Not Found"
**Oorzaak:** Edge Function is niet gedeployed
**Oplossing:**
- Check of `send-reminder-email` in de Functions lijst staat
- Deploy de function opnieuw

### Probleem: "RESEND_API_KEY secret is not configured"
**Oorzaak:** Secret ontbreekt of verkeerde naam
**Oplossing:**
- Check of secret exact heet: `RESEND_API_KEY` (hoofdletters!)
- Re-deploy de function na het toevoegen van secrets

### Probleem: "Invalid request body"
**Oorzaak:** Verkeerde data format
**Oplossing:**
- Check of `userIds` een array is
- Check of `weekNumber` en `year` nummers zijn (niet strings)

## Test Checklist

- [ ] Edge Function staat in Functions lijst
- [ ] Edge Function heeft een URL
- [ ] Edge Function is recent gedeployed ("just now" of recent)
- [ ] Secrets `RESEND_API_KEY` en `RESEND_FROM_EMAIL` bestaan
- [ ] Email adres is geverifieerd in Resend
- [ ] Edge Function logs tonen geen errors
- [ ] Network request heeft status 200
- [ ] Response bevat data (niet alleen error)

Als alles is aangevinkt maar het werkt nog niet, deel:
1. Screenshot van Edge Function logs
2. Screenshot van Network request (Request + Response tabs)
3. Exacte error message
