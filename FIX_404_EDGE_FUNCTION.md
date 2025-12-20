# Fix: 404 Error - Edge Function niet gevonden

## Probleem
Je ziet in de Network tab:
- **Status: 404** voor `invite-user`
- **Status: CORS error** voor `invite-user`

Dit betekent dat de Edge Function **niet bestaat** of **niet gedeployed** is in Supabase.

## Oplossing: Deploy de Edge Function

### Stap 1: Ga naar Supabase Dashboard
1. Open: https://supabase.com/dashboard
2. Selecteer je project (`bgddtkiekjcdhcmrnxsi`)

### Stap 2: Check of Edge Function bestaat
1. Klik in het linker menu op **"Edge Functions"**
2. Klik op **"Functions"**
3. **Zoek naar `invite-user` in de lijst**

### Stap 3A: Als `invite-user` NIET bestaat

**Dit is het probleem!** De Edge Function bestaat niet.

#### Oplossing: Maak de Edge Function aan

1. Klik op **"Create new edge function"** (of **"New function"** of **"Deploy a new function"**)
2. Function name: `invite-user` 
   - ⚠️ **BELANGRIJK:** Exact zoals dit: `invite-user` (kleine letters, met streepje, geen spaties)
3. Klik op **"Create function"** (of **"Create"**)
4. Je ziet nu een code editor
5. **Verwijder ALLE code** die er al in staat
6. **Kopieer ALLE code** uit dit bestand: `supabase/functions/invite-user/index.ts`
   - Of open het bestand in je project: `time-track-teamwork-excel-main/supabase/functions/invite-user/index.ts`
7. **Plak** de code in de Supabase editor
8. Klik op **"Deploy function"** (of **"Deploy"** of **"Save"**)
9. Wacht tot je ziet: **"Function deployed successfully"** of **"Deployed"**

### Stap 3B: Als `invite-user` WEL bestaat

1. Klik op `invite-user` in de lijst
2. Check of de code klopt:
   - Staat er `Deno.serve(async (req) => {` aan het begin?
   - Zijn er CORS headers?
3. Als de code anders is of incompleet:
   - Klik op **"Edit"**
   - Kopieer ALLE code uit: `supabase/functions/invite-user/index.ts`
   - Vervang de oude code
   - Klik op **"Deploy function"**
4. Wacht tot deployment klaar is

### Stap 4: Check Deployment Status

Na het deployen:
1. Check of `invite-user` in de lijst staat met status **"Active"** of **"Deployed"**
2. Check de **"UPDATED"** kolom - dit moet net zijn (bijv. "just now" of "1 minute ago")
3. Check de **"DEPLOYMENTS"** kolom - dit moet minimaal 1 zijn

### Stap 5: Test opnieuw

1. Ga terug naar je website
2. **Refresh de pagina** (Ctrl + Shift + R om cache te clearen)
3. Open browser console (F12) → **Network** tab
4. Klik op **"Test Edge Function"** knop
5. Kijk in de Network tab:
   - **Status 200?** → ✅ Function werkt!
   - **Status 404?** → ❌ Function bestaat nog steeds niet, check Stap 2 opnieuw
   - **Status 401/403?** → ❌ Authentication probleem, check environment variables

### Stap 6: Check Supabase Logs (als het nog niet werkt)

1. Ga naar **Edge Functions** → **Logs**
2. Klik op `invite-user` (als die bestaat)
3. Kijk naar recente logs:
   - Zie je requests binnenkomen?
   - Zie je errors?
   - Wat staat er in de logs?

## Belangrijk

✅ De Edge Function moet **gedeployed** zijn, niet alleen aangemaakt!
✅ De function name moet exact `invite-user` zijn (kleine letters, met streepje)
✅ Na deployen, wacht 10-30 seconden voordat je test
✅ Refresh je website na het deployen (Ctrl + Shift + R)

## Veelvoorkomende Fouten

### Fout 1: Function name is verkeerd
- ❌ `InviteUser` (hoofdletters)
- ❌ `invite_user` (underscore)
- ❌ `invite user` (spatie)
- ✅ `invite-user` (kleine letters, met streepje)

### Fout 2: Code is niet compleet
- Check of alle code is geplakt
- Check of er geen syntax errors zijn (rode onderstrepingen in editor)

### Fout 3: Function is niet gedeployed
- Alleen aanmaken is niet genoeg!
- Je moet op **"Deploy function"** klikken
- Wacht tot je "Function deployed successfully" ziet

## Wat te delen met mij

Als het nog steeds niet werkt na deze stappen, deel dan:
1. Screenshot van Supabase Dashboard → Edge Functions → Functions (laat zien of `invite-user` in de lijst staat)
2. Screenshot van de Edge Function code editor (laat zien wat er in de editor staat)
3. Wat er in Supabase Logs staat (Edge Functions → Logs → invite-user)
4. Wat je ziet in de Network tab na het testen


