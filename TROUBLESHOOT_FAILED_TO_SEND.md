# Troubleshooting: "Failed to send a request to the Edge Function"

## Probleem
Je krijgt de foutmelding: **"Failed to send a request to the Edge Function"** wanneer je de Edge Function probeert aan te roepen.

## Mogelijke Oorzaken

### 1. Edge Function bestaat niet of is niet gedeployed
**Check:**
1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Zoek naar `invite-user` in de lijst
3. **Als het er NIET is:**
   - Klik op **"Create new edge function"**
   - Function name: `invite-user` (exact, kleine letters, met streepje)
   - Kopieer ALLE code uit: `supabase/functions/invite-user/index.ts`
   - Plak in de editor
   - Klik op **"Deploy function"**
   - Wacht tot je ziet: "Function deployed successfully"

### 2. Edge Function heeft een syntax error
**Check:**
1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Klik op `invite-user`
3. Check of de code correct is:
   - Staat er `Deno.serve(async (req) => {` aan het begin?
   - Zijn er geen syntax errors (rode onderstrepingen)?
   - Is de code compleet (geen ontbrekende sluitende haakjes)?

### 3. Supabase Client configuratie probleem
**Check:**
1. Open browser console (F12)
2. Typ: `console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL)`
3. Typ: `console.log("Anon Key:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "Set" : "Missing")`
4. **Verwacht:**
   - Supabase URL: `https://bgddtkiekjcdhcmrnxsi.supabase.co`
   - Anon Key: `Set`

**Als deze ontbreken:**
- Check Netlify Dashboard → Site settings → Environment variables
- Zorg dat `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` zijn ingesteld
- Re-deploy je site na het toevoegen van environment variables

### 4. Edge Function heeft een runtime error
**Check Supabase Logs:**
1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Klik op `invite-user`
3. Kijk naar recente logs:
   - Zie je requests binnenkomen?
   - Zie je errors?
   - Wat staat er in de logs?

**Veelvoorkomende errors:**
- `Missing SUPABASE_URL` → Environment variabelen probleem in Edge Function
- `Missing SUPABASE_SERVICE_ROLE_KEY` → Environment variabelen probleem
- `Email already registered` → Email bestaat al in Supabase Auth

### 5. CORS of Network probleem
**Test direct in browser console:**
1. Open browser console (F12)
2. Typ dit (vervang met je echte waarden):

```javascript
const supabaseUrl = "https://bgddtkiekjcdhcmrnxsi.supabase.co";
const anonKey = "JE_ANON_KEY_HIER"; // Vervang met je echte anon key

fetch(`${supabaseUrl}/functions/v1/invite-user`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${anonKey}`,
  },
  body: JSON.stringify({
    email: "test@example.com",
    name: "Test User",
    isAdmin: false
  })
})
.then(r => {
  console.log("Status:", r.status);
  return r.text();
})
.then(text => {
  console.log("Response:", text);
  try {
    console.log("Parsed:", JSON.parse(text));
  } catch(e) {
    console.log("Could not parse as JSON");
  }
})
.catch(err => {
  console.error("Error:", err);
});
```

**Wat zie je?**
- Status 200? → Function werkt, probleem is met Supabase client
- Status 404? → Function bestaat niet
- Status 401/403? → Anon key probleem
- Network error? → CORS of URL probleem

## Stap-voor-stap Oplossing

### Stap 1: Check Browser Console
1. Open je website
2. Druk op **F12** → **Console** tab
3. Klik op **"Test Edge Function"** knop
4. Kijk naar de console output:
   - Zie je `🧪 Supabase client response:`?
   - Wat staat er bij `error`?
   - Kopieer de volledige error message

### Stap 2: Check Supabase Dashboard
1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Staat `invite-user` in de lijst?
   - **NEE** → Volg Stap 3
   - **JA** → Ga naar Stap 4

### Stap 3: Deploy Edge Function
1. Klik op **"Create new edge function"**
2. Function name: `invite-user`
3. Kopieer ALLE code uit: `supabase/functions/invite-user/index.ts`
4. Plak in de editor
5. Klik op **"Deploy function"**
6. Wacht tot deployment klaar is
7. Test opnieuw

### Stap 4: Check Edge Function Logs
1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Klik op `invite-user`
3. Kijk naar recente logs:
   - Zie je requests binnenkomen?
   - Zie je errors?
   - Wat staat er in de logs?

### Stap 5: Test Direct in Supabase
1. Ga naar **Authentication** → **Users**
2. Klik op **"Invite user"** (rechtsboven)
3. Voer een test email in
4. Klik **"Send invitation"**
5. **Krijg je WEL een email?**
   - **JA** → Supabase email service werkt, probleem is met Edge Function
   - **NEE** → Supabase email service probleem

## Wat te delen met mij

Als het nog steeds niet werkt, deel dan:
1. De exacte error message uit de browser console (F12)
2. Wat er in Supabase Logs staat (Edge Functions → Logs → invite-user)
3. Of de Edge Function bestaat (Supabase Dashboard → Edge Functions → Functions)
4. De output van de browser console test (Stap 5 hierboven)










