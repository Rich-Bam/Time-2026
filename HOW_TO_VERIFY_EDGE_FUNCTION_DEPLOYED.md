# Hoe weet je zeker dat de Edge Function gedeployed is?

## Stap 1: Check Supabase Dashboard → Edge Functions → Functions

1. Ga naar: https://supabase.com/dashboard
2. Selecteer je project (`bgddtkiekjcdhcmrnxsi`)
3. Klik in het linker menu op **"Edge Functions"**
4. Klik op **"Functions"** (of je ziet direct een lijst)

### Wat je moet zien:

✅ **Als de function GEDEPLOYED is:**
- Je ziet `invite-user` in de lijst met functions
- Er staat een **URL** naast (bijv. `https://bgddtkiekjcdhcmrnxsi.supabase.co/functions/v1/invite-user`)
- Er staat een **"UPDATED"** tijd (bijv. "2 hours ago", "just now", "1 minute ago")
- Er staat een **"DEPLOYMENTS"** nummer (bijv. "1", "2", "3" - dit moet minimaal 1 zijn)
- De function heeft een status zoals **"Active"** of **"Deployed"**

❌ **Als de function NIET gedeployed is:**
- Je ziet `invite-user` NIET in de lijst
- OF je ziet alleen een lege lijst met "No functions yet"

## Stap 2: Check de Function Details

1. Klik op `invite-user` in de lijst (als die er is)
2. Je ziet nu de function details pagina

### Wat je moet zien:

✅ **Als de function GEDEPLOYED is:**
- Je ziet de code editor met code erin
- Er staat een **"Deploy"** of **"Deploy function"** knop (maar de code is al gedeployed)
- Er staat een **"Logs"** tab of link
- Er staat een **"Settings"** tab of link
- Er staat een **URL** bovenaan (bijv. `https://bgddtkiekjcdhcmrnxsi.supabase.co/functions/v1/invite-user`)

❌ **Als de function NIET gedeployed is:**
- Je ziet een lege editor
- Er staat alleen "Create function" of "New function"
- Er is geen URL zichtbaar

## Stap 3: Check de Deployment Status

### In de Functions lijst:

Kijk naar deze kolommen:

1. **NAME:** `invite-user` ✅
2. **URL:** Moet een URL bevatten (bijv. `https://...supabase.co/functions/v1/invite-user`) ✅
3. **UPDATED:** Moet een tijd bevatten (bijv. "just now", "2 hours ago") ✅
4. **DEPLOYMENTS:** Moet een nummer bevatten (minimaal 1) ✅

### Als een van deze ontbreekt:
- De function is NIET gedeployed
- Volg de stappen in `FIX_404_EDGE_FUNCTION.md` om hem te deployen

## Stap 4: Test de Function Direct

### Optie A: Via Supabase Dashboard

1. Ga naar **Edge Functions** → **Functions** → `invite-user`
2. Kijk of er een **"Test"** of **"Invoke"** knop is
3. Als die er is, klik erop en test de function

### Optie B: Via Browser Console

1. Open je website
2. Druk op **F12** → **Console** tab
3. Typ dit (vervang met je echte waarden):

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
  if (r.status === 404) {
    console.error("❌ Function bestaat NIET (404)");
  } else if (r.status === 200) {
    console.log("✅ Function bestaat en werkt!");
  }
  return r.text();
})
.then(text => {
  console.log("Response:", text);
})
.catch(err => {
  console.error("Error:", err);
});
```

**Wat je ziet:**
- **Status 200** → ✅ Function is gedeployed en werkt!
- **Status 404** → ❌ Function bestaat niet of is niet gedeployed
- **Status 401/403** → Function bestaat, maar authentication probleem

## Stap 5: Check Supabase Logs

1. Ga naar **Edge Functions** → **Logs**
2. Klik op `invite-user` (als die in de lijst staat)

### Wat je moet zien:

✅ **Als de function GEDEPLOYED is:**
- Je ziet een lijst met logs (ook al is die leeg)
- Er staat een filter of zoekbalk
- Je kunt logs bekijken (ook al zijn er geen recente)

❌ **Als de function NIET gedeployed is:**
- Je ziet `invite-user` NIET in de logs lijst
- OF je ziet een error: "Function not found"

## Stap 6: Re-deploy om zeker te zijn

Als je twijfelt, re-deploy de function:

1. Ga naar **Edge Functions** → **Functions** → `invite-user`
2. Klik op **"Edit"** (als die er is)
3. Klik opnieuw op **"Deploy function"** of **"Deploy"**
4. Wacht tot je ziet: **"Function deployed successfully"** of **"Deployed"**
5. Check de **"UPDATED"** tijd - deze moet nu "just now" of "1 minute ago" zijn

## Checklist: Is de function gedeployed?

Vink af wat je ziet:

- [ ] `invite-user` staat in de Functions lijst
- [ ] Er staat een URL naast de function name
- [ ] Er staat een "UPDATED" tijd (niet leeg)
- [ ] Er staat een "DEPLOYMENTS" nummer (minimaal 1)
- [ ] Als je op de function klikt, zie je code in de editor
- [ ] Er is een "Logs" tab of link zichtbaar
- [ ] Test in browser console geeft status 200 (niet 404)

**Als ALLE items zijn aangevinkt:** ✅ De function is gedeployed!

**Als een item NIET is aangevinkt:** ❌ De function is NIET gedeployed - volg `FIX_404_EDGE_FUNCTION.md`

## Screenshot voorbeelden

### ✅ Goed - Function is gedeployed:
```
NAME          | URL                                    | UPDATED      | DEPLOYMENTS
invite-user   | https://...supabase.co/functions/v1/... | 2 hours ago  | 3
```

### ❌ Fout - Function bestaat niet:
```
(Lege lijst of invite-user staat er niet in)
```

## Nog steeds niet zeker?

Deel een screenshot van:
1. Supabase Dashboard → Edge Functions → Functions (laat de lijst zien)
2. Als `invite-user` er is, klik erop en deel een screenshot van de function details pagina

Dan kan ik je precies vertellen of het gedeployed is!







