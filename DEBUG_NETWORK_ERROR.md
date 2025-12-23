# Debug Network Error - Edge Function

## Stap 1: Check Browser Console

1. Open je website
2. Druk op **F12** → **Console** tab
3. Klik op **"Test Edge Function"** knop
4. Kijk naar de console output:
   - Zie je `🧪 Function URL:`?
   - Wat is de exacte URL?
   - Zie je errors?

## Stap 2: Check Supabase Logs

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Klik op `invite-user`
3. Kijk naar recente logs:
   - Zie je requests binnenkomen?
   - Zie je errors?
   - Wat staat er in de logs?

## Stap 3: Test Direct in Browser Console

Open browser console (F12) en typ dit (vervang met je echte waarden):

```javascript
// Vervang deze waarden met je echte Supabase URL en Anon Key
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
- Status 200? → Function werkt!
- Status 404? → Function bestaat niet of URL is verkeerd
- Status 401/403? → Anon key probleem
- Network error? → CORS of URL probleem

## Stap 4: Check Edge Function Code

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Functions**
2. Klik op `invite-user`
3. Check of de code klopt:
   - Staat er `Deno.serve(async (req) => {` aan het begin?
   - Zijn de CORS headers aanwezig?
   - Is de code compleet?

## Stap 5: Check Environment Variables

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Check of deze bestaan (hoeven niet handmatig toegevoegd te worden, maar check voor de zekerheid):
   - `SUPABASE_URL` - Automatisch beschikbaar
   - `SUPABASE_SERVICE_ROLE_KEY` - Automatisch beschikbaar
   - `APP_URL` - Optioneel (zet op `https://bampro-uren.nl`)

## Mogelijke Oplossingen

### Oplossing 1: Re-deploy Edge Function
1. Ga naar **Edge Functions** → **Functions** → `invite-user`
2. Klik op **"Edit"**
3. Klik opnieuw op **"Deploy function"**
4. Wacht tot deployment klaar is
5. Test opnieuw

### Oplossing 2: Check URL Format
De URL moet zijn:
```
https://bgddtkiekjcdhcmrnxsi.supabase.co/functions/v1/invite-user
```

NIET:
```
https://bgddtkiekjcdhcmrnxsi.supabase.co/functions/invite-user
```

### Oplossing 3: Check CORS
De Edge Function heeft CORS headers, maar misschien blokkeert de browser het. Test in een incognito venster.

### Oplossing 4: Check Netlify Environment Variables
1. Ga naar Netlify Dashboard
2. Ga naar je site → **Site settings** → **Environment variables**
3. Check of `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` correct zijn ingesteld

## Wat te delen met mij

Als het nog steeds niet werkt, deel dan:
1. De exacte URL die je ziet in de console (`🧪 Function URL:`)
2. De status code die je ziet (als die er is)
3. Wat er in Supabase Logs staat
4. De output van de browser console test (Stap 3)









