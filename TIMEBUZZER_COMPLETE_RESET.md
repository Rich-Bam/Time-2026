# Timebuzzer Integration - Complete Reset vanaf Nul

## ⚠️ BELANGRIJK: Volg deze stappen EXACT in deze volgorde!

---

## DEEL 1: Verificatie - Check wat er NU is

### Stap 1: Check of de functie bestaat

1. **Ga naar**: https://supabase.com/dashboard
2. **Selecteer project**: `Timer-tracker-2026`
3. **Klik**: Edge Functions (linker sidebar)
4. **Klik**: Functions (onder MANAGE)
5. **Check**: Zie je `timebuzzer-sync` in de lijst?

   - ✅ **JA** → Ga naar Stap 2
   - ❌ **NEE** → Ga naar DEEL 2 (Functie aanmaken)

### Stap 2: Check of de Secret bestaat

1. **Blijf in**: Edge Functions
2. **Klik**: Secrets (onder MANAGE)
3. **Check**: Zie je `TIMEBUZZER_API_KEY` in de lijst?

   - ✅ **JA** → Ga naar Stap 3
   - ❌ **NEE** → Ga naar DEEL 3 (Secret toevoegen)

### Stap 3: Check de functie status

1. **Ga terug naar**: Functions
2. **Klik op**: `timebuzzer-sync` (de naam zelf)
3. **Check de "UPDATED" tijd**:
   - Als het ouder is dan 5 minuten → Ga naar DEEL 4 (Redeploy)
   - Als het recent is → Ga naar DEEL 5 (Testen)

---

## DEEL 2: Functie Aanmaken (Als het nog niet bestaat)

### Stap 1: Open de code editor

1. **Open**: `time-track-teamwork-excel-main\supabase\functions\timebuzzer-sync\index.ts`
2. **Selecteer ALLES** (Ctrl+A)
3. **Kopieer** (Ctrl+C)

### Stap 2: Maak functie aan in Supabase

1. **Ga naar**: Supabase Dashboard → Edge Functions → Functions
2. **Klik**: "Deploy a new function" (groene knop rechtsboven)
3. **Als je wordt gevraagd om een template te kiezen**: Kies "Blank" of "Write from scratch"
4. **Geef een naam**: `timebuzzer-sync`
   - ⚠️ **LET OP**: Exact deze naam, kleine letters, met streepje
   - ❌ NIET: `timebuzzer_sync`, `TimebuzzerSync`, `timebuzzerSync`

### Stap 3: Plak de code

1. **Verwijder** alle voorbeeld code in de editor
2. **Plak** je gekopieerde code (Ctrl+V)
3. **Check** of alle code er staat (scroll naar beneden)

### Stap 4: Deploy

1. **Klik**: "Deploy" knop (meestal rechtsboven)
2. **Wacht** tot je "Function deployed successfully" ziet

✅ **SUCCES**: Functie is aangemaakt!

---

## DEEL 3: Secret Toevoegen (BELANGRIJK!)

### Stap 1: Ga naar Secrets

1. **In Supabase Dashboard**: Edge Functions → Secrets
2. **Klik**: "Add secret" of "New secret"

### Stap 2: Vul de Secret in

**Name** (exact zoals hier, kopieer dit):
```
TIMEBUZZER_API_KEY
```

**Value** (exact zoals hier, kopieer dit):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI
```

### Stap 3: Save

1. **Klik**: "Save" of "Add"
2. **Verifieer**: Je zou nu `TIMEBUZZER_API_KEY` moeten zien in de lijst

✅ **SUCCES**: Secret is toegevoegd!

---

## DEEL 4: Functie Redeployen (NA het toevoegen van Secret!)

### ⚠️ BELANGRIJK: Je MOET de functie opnieuw deployen NA het toevoegen van een secret!

### Stap 1: Ga naar de functie

1. **Ga naar**: Edge Functions → Functions
2. **Klik op**: `timebuzzer-sync` (de naam zelf, niet het dropdown pijltje)

### Stap 2: Redeploy

1. **Scroll** naar beneden op de functie detail pagina
2. **Zoek** de knop:
   - "Redeploy" OF
   - "Deploy" OF  
   - "Save and Deploy"
3. **Klik** op deze knop
4. **Wacht** tot deployment klaar is (je ziet "Deployment successful")

### Stap 3: Verifieer

1. **Ga terug** naar Functions lijst
2. **Check** de "UPDATED" kolom bij `timebuzzer-sync`
3. Dit zou nu moeten zeggen: "just now" of "a few seconds ago"

✅ **SUCCES**: Functie is gedeployed met de secret!

---

## DEEL 5: Testen

### Stap 1: Ververs je website

1. **Open** je website (localhost of live)
2. **Druk**: Ctrl+F5 (of Cmd+Shift+R op Mac) om hard refresh te doen
   - Dit zorgt dat oude cache wordt gewist

### Stap 2: Open Browser Console

1. **Druk**: F12 (of rechtsklik → Inspect)
2. **Klik** op: "Console" tab
3. **Clear** de console (veeg alle oude berichten weg)

### Stap 3: Test de API

1. **Log in** als admin
2. **Ga naar**: Admin Panel
3. **Scroll** naar beneden naar "Timebuzzer Integration"
4. **Klik**: "Test API" knop (oranje knop)
5. **Kijk in de console** - je zou moeten zien:
   ```
   Testing Timebuzzer API...
   Response: { data: {...}, error: ... }
   ```

### Stap 4: Check het resultaat

**✅ Als het werkt:**
- Console toont: `error: null`
- Je ziet een groene toast: "API Test Successful"

**❌ Als het niet werkt:**
- Console toont een error
- Noteer de EXACTE error message
- Deel deze met me!

---

## DEEL 6: Troubleshooting - Als het nog steeds niet werkt

### Probleem 1: "Failed to send a request to the Edge Function"

**Mogelijke oorzaken:**

1. **Functie bestaat niet** → Zie DEEL 2
2. **Functie is niet gedeployed** → Zie DEEL 4
3. **Secret ontbreekt** → Zie DEEL 3
4. **Functie naam is verkeerd** → Check of het exact `timebuzzer-sync` is

**Debug stappen:**

1. **Check functie logs**:
   - Supabase Dashboard → Edge Functions → Functions → timebuzzer-sync
   - Klik op "Logs" tab
   - Kijk of er errors staan

2. **Check browser console**:
   - F12 → Console tab
   - Klik "Test API"
   - Kijk naar de EXACTE error message

3. **Check Network tab**:
   - F12 → Network tab
   - Klik "Test API"
   - Zoek naar een request naar `functions/v1/timebuzzer-sync`
   - Klik erop en check de response

### Probleem 2: "TIMEBUZZER_API_KEY not configured"

**Oplossing:**
- Secret bestaat niet of is niet correct
- Ga naar DEEL 3 en voeg secret toe
- **BELANGRIJK**: Redeploy functie daarna (DEEL 4)

### Probleem 3: "Function not found" of 404 error

**Oplossing:**
- Functie bestaat niet of naam is verkeerd
- Ga naar DEEL 2 en maak functie aan
- Check of naam exact is: `timebuzzer-sync`

---

## Checklist: Alles correct ingesteld?

Voor je test, check dit:

- [ ] Functie `timebuzzer-sync` bestaat in Edge Functions → Functions
- [ ] Secret `TIMEBUZZER_API_KEY` bestaat in Edge Functions → Secrets
- [ ] Functie "UPDATED" tijd is recent (laatste paar minuten)
- [ ] Je hebt functie gedeployed NADAT je secret hebt toegevoegd
- [ ] Browser console is open (F12 → Console)
- [ ] Je hebt website hard refresh gedaan (Ctrl+F5)

**Als alles is aangevinkt → Test opnieuw!**

---

## Snelle Commando's (voor PowerShell)

Als je de CLI wilt gebruiken, voer deze uit in PowerShell:

```powershell
# Navigate naar project
cd c:\time-track-teamwork-excel-main

# Login (als je nog niet ingelogd bent)
npx supabase login

# Link project (als je dit nog niet hebt gedaan)
npx supabase link --project-ref bgddtkiekjcdhcmrnxsi

# Set secret
npx supabase secrets set TIMEBUZZER_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI

# Deploy functie
npx supabase functions deploy timebuzzer-sync
```

---

## Laatste Redmiddel: Functie Volledig Verwijderen en Opnieuw Aanmaken

Als NIETS werkt:

1. **Verwijder functie**:
   - Edge Functions → Functions → timebuzzer-sync
   - Klik dropdown pijltje → Delete
   - Bevestig

2. **Verwijder secret** (optioneel):
   - Edge Functions → Secrets
   - Klik op `TIMEBUZZER_API_KEY` → Delete

3. **Start opnieuw** vanaf DEEL 2

---

## Wat te delen als het nog steeds niet werkt:

1. **Screenshot** van:
   - Edge Functions → Functions lijst
   - Edge Functions → Secrets lijst
   - Browser console (F12 → Console) na "Test API" klik

2. **Exacte error message** uit:
   - Browser console
   - Edge Function logs (Supabase Dashboard → Functions → timebuzzer-sync → Logs)

3. **Checklist status** (welke punten zijn aangevinkt?)









