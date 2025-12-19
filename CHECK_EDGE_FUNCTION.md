# Check of Edge Function bestaat

## Stap 1: Ga naar Supabase Dashboard

1. Open: https://supabase.com/dashboard
2. Selecteer je project (`bgddtkiekjcdhcmrnxsi`)

## Stap 2: Check Edge Functions

1. Klik in het linker menu op **"Edge Functions"**
2. Klik op **"Functions"** (of je ziet direct een lijst)
3. **Zoek naar `invite-user` in de lijst**

## Stap 3A: Als `invite-user` NIET bestaat

**Dit is waarschijnlijk het probleem!** De Edge Function bestaat niet.

### Oplossing: Maak de Edge Function aan

1. Klik op **"Create new edge function"** (of **"New function"**)
2. Function name: `invite-user` (exact zoals dit, kleine letters, met streepje)
3. Klik op **"Create function"**
4. **Kopieer ALLE code** uit: `supabase/functions/invite-user/index.ts`
5. **Plak** de code in de editor
6. Klik op **"Deploy function"** (of **"Deploy"**)
7. Wacht tot je ziet: "Function deployed successfully"

## Stap 3B: Als `invite-user` WEL bestaat

1. Klik op `invite-user` in de lijst
2. Check of de code klopt (vergelijk met `supabase/functions/invite-user/index.ts`)
3. Als de code anders is, update hem:
   - Klik op **"Edit"**
   - Vervang de code
   - Klik op **"Deploy function"**

## Stap 4: Test opnieuw

1. Ga terug naar je website
2. Refresh de pagina (Ctrl + Shift + R)
3. Klik opnieuw op **"Test Edge Function"**
4. Je zou nu een andere melding moeten zien (niet meer "Network Error")

## Stap 5: Check Logs (als het nog niet werkt)

1. Ga naar **Edge Functions** → **Logs**
2. Klik op `invite-user`
3. Kijk naar recente logs
4. Zie je errors? Deel ze met mij!

## Belangrijk

✅ De Edge Function moet **gedeployed** zijn, niet alleen aangemaakt!
✅ De function name moet exact `invite-user` zijn (kleine letters, met streepje)
✅ Na deployen, wacht 10-30 seconden voordat je test

