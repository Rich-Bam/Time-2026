# Hoe Deploy Je de Timebuzzer Edge Function - Volledige Uitleg

## Methode 1: Via Supabase Dashboard (Aanbevolen voor beginners)

### Stap 1: Ga naar Edge Functions in Supabase

1. **Open je browser** en ga naar: https://supabase.com/dashboard
2. **Log in** met je Supabase account
3. **Selecteer je project** `Timer-tracker-2026` (of je project naam)
4. In de **linker sidebar**, zie je verschillende opties zoals:
   - Table Editor
   - SQL Editor
   - Storage
   - Edge Functions ← **KLIK HIEROP**
   - etc.

### Stap 2: Open de timebuzzer-sync functie

1. Je ziet nu een pagina met **"Edge Functions"** als titel
2. Links zie je onder **"MANAGE"**:
   - Functions
   - Secrets
3. **Klik op "Functions"** (dit zou al geselecteerd moeten zijn)
4. In het hoofdscherm zie je een tabel met functies zoals:
   - invite-user
   - super-action
   - timebuzzer-sync ← **KLIK HIEROP**
5. **Klik op de naam "timebuzzer-sync"** (niet op het dropdown pijltje, maar op de naam zelf)

### Stap 3: Redeploy de functie

Nu zie je de detail pagina van de functie:

1. **Scroll naar beneden** in de pagina
2. Zoek naar een knop die zegt:
   - **"Redeploy"** OF
   - **"Deploy"** OF
   - **"Save and Deploy"**
3. **Klik op deze knop**
4. Wacht een paar seconden - je ziet meestal:
   - Een loading indicator
   - Een melding "Deploying..." of "Redeploying..."
   - Daarna "Deployment successful" of een groene vink

**✅ SUCCES:** Als je een groene melding ziet, is de functie gedeployed!

### Stap 4: Verifieer dat het werkt

1. **Ga terug** naar de functies lijst (klik op "Functions" in de sidebar)
2. Zoek `timebuzzer-sync` in de tabel
3. Kijk naar de **"UPDATED"** kolom
4. Dit zou nu moeten zeggen:
   - "just now" OF
   - "a few seconds ago" OF
   - "X minutes ago" (met een recente tijd)

Als de tijd recent is, is de functie succesvol gedeployed! ✅

---

## Methode 2: Via Supabase CLI (Als Dashboard niet werkt)

### Stap 1: Installeer Supabase CLI (als je het nog niet hebt)

1. **Open PowerShell** (niet CMD, maar PowerShell)
   - Druk op `Windows + X`
   - Kies "Windows PowerShell" of "Terminal"

2. **Installeer Supabase CLI**:
   ```powershell
   npm install -g supabase
   ```
   - Dit kan een paar minuten duren
   - Wacht tot het klaar is

### Stap 2: Login bij Supabase

1. **Voer dit commando uit**:
   ```powershell
   npx supabase login
   ```
2. **Dit opent automatisch je browser**
3. **Log in** met je Supabase account
4. **Authorize** de CLI toegang
5. **Terug naar PowerShell** - je zou "Login successful" moeten zien

### Stap 3: Link je project

1. **Ga naar je project folder**:
   ```powershell
   cd c:\time-track-teamwork-excel-main
   ```

2. **Link je Supabase project**:
   ```powershell
   npx supabase link --project-ref bgddtkiekjcdhcmrnxsi
   ```
   
   **BELANGRIJK:** Vervang `bgddtkiekjcdhcmrnxsi` met je eigen project reference als die anders is!
   
   - Je project reference vind je in Supabase Dashboard
   - In de URL: `https://supabase.com/dashboard/project/bgddtkiekjcdhcmrnxsi`
   - Het deel na `/project/` is je project reference

3. **Als je wordt gevraagd om een database password:**
   - Je kunt dit meestal skippen door Enter te drukken
   - Of gebruik je Supabase database password (niet je login password!)

### Stap 4: Deploy de functie

1. **Zorg dat je in de juiste folder bent**:
   ```powershell
   cd c:\time-track-teamwork-excel-main
   ```

2. **Deploy de timebuzzer-sync functie**:
   ```powershell
   npx supabase functions deploy timebuzzer-sync
   ```

3. **Wacht tot het klaar is** - je ziet:
   ```
   Deploying function timebuzzer-sync...
   Function deployed successfully!
   URL: https://bgddtkiekjcdhcmrnxsi.supabase.co/functions/v1/timebuzzer-sync
   ```

**✅ SUCCES:** Als je "Function deployed successfully!" ziet, is het klaar!

### Stap 5: Set de Secret via CLI (Als je dit nog niet via Dashboard hebt gedaan)

**BELANGRIJK:** De secret moet ALTIJD worden ingesteld voordat de functie werkt!

```powershell
npx supabase secrets set TIMEBUZZER_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI
```

**Let op:** 
- Geen spaties rond de `=` 
- De gehele API key moet worden gekopieerd (het is een lange string)

Na dit commando, deploy de functie opnieuw:
```powershell
npx supabase functions deploy timebuzzer-sync
```

---

## Methode 3: Functie Opnieuw Aanmaken (Als niets werkt)

Als de functie niet bestaat of volledig kapot is:

### Stap 1: Verwijder de oude functie (optioneel)

1. Ga naar Supabase Dashboard → Edge Functions → Functions
2. Zoek `timebuzzer-sync`
3. Klik op de **dropdown pijltje** (niet de naam!)
4. Kies **"Delete"** of **"Remove"**
5. Bevestig de verwijdering

### Stap 2: Maak de functie opnieuw aan

1. **Ga naar**: Supabase Dashboard → Edge Functions → Functions
2. **Klik op**: **"Deploy a new function"** of **"Create Function"** (groene knop rechtsboven)
3. **Kies**: **"Create from template"** of **"Write from scratch"**
4. **Geef een naam**: `timebuzzer-sync`
   - Let op: gebruik exact deze naam, met een streepje, kleine letters

### Stap 3: Kopieer de code

1. **Open** het bestand: `time-track-teamwork-excel-main\supabase\functions\timebuzzer-sync\index.ts`
2. **Selecteer alle tekst** (Ctrl+A)
3. **Kopieer** (Ctrl+C)

### Stap 4: Plak de code in Supabase

1. In de Supabase code editor, **verwijder alle voorbeeld code**
2. **Plak je gekopieerde code** (Ctrl+V)
3. **Check** of alle code correct is geplakt (scroll door de code heen)

### Stap 5: Deploy

1. **Klik op**: **"Deploy"** knop (meestal rechtsboven of onderaan)
2. **Wacht** tot deployment klaar is

### Stap 6: Voeg de Secret toe

**BELANGRIJK:** Zonder deze secret werkt de functie NIET!

1. **Ga naar**: Edge Functions → **Secrets**
2. **Klik op**: **"Add secret"**
3. **Name**: `TIMEBUZZER_API_KEY` (exact zo, hoofdletters)
4. **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI`
5. **Klik**: **"Save"**

### Stap 7: Redeploy de functie

**Nogmaals belangrijk:** Na het toevoegen van een secret, moet je de functie opnieuw deployen!

1. **Ga terug naar**: Edge Functions → Functions
2. **Klik op**: `timebuzzer-sync`
3. **Klik op**: **"Redeploy"** of **"Deploy"**

---

## Verificatie Checklist

Voordat je test, check deze dingen:

### ✅ Checklist:

- [ ] Secret `TIMEBUZZER_API_KEY` bestaat in Edge Functions → Secrets
- [ ] Functie `timebuzzer-sync` bestaat in Edge Functions → Functions
- [ ] De "UPDATED" tijd van de functie is recent (laatste paar minuten)
- [ ] Je hebt de functie gedeployed NADAT je de secret hebt toegevoegd

### ❌ Veelvoorkomende Fouten:

1. **Secret bestaat niet**
   - Oplossing: Voeg de secret toe (zie boven)
   
2. **Functie is niet gedeployed na het toevoegen van secret**
   - Oplossing: Deploy de functie opnieuw
   
3. **Functie naam is verkeerd**
   - Moet exact zijn: `timebuzzer-sync` (kleine letters, streepje)
   - NIET: `timebuzzer_sync`, `TimebuzzerSync`, etc.
   
4. **Code is niet correct gekopieerd**
   - Oplossing: Kopieer opnieuw uit `supabase/functions/timebuzzer-sync/index.ts`

---

## Testen

Na het deployen:

1. **Ga naar je website** (localhost of live site)
2. **Log in als admin**
3. **Ga naar Admin Panel**
4. **Scroll naar "Timebuzzer Integration"** (groene sectie onderaan)
5. **Open browser console** (F12 → Console tab)
6. **Klik op "Test API"**
7. **Check de console** voor:
   - `Testing Timebuzzer API...`
   - `Response: { data: {...}, error: ... }`

### Wat je zou moeten zien:

**✅ Als het werkt:**
```
Testing Timebuzzer API...
Response: { data: { success: true, status: 200, ... }, error: null }
```

**❌ Als het niet werkt:**
```
Testing Timebuzzer API...
Test API Error: [error message hier]
```

**Deel de exacte error message met me als het niet werkt!**

---

## Hulp Nodig?

Als niets werkt, deel met me:

1. **Welke methode** je hebt geprobeerd (Dashboard of CLI)
2. **Wat je ziet** in de browser console (F12 → Console)
3. **Wat je ziet** in Supabase Dashboard → Edge Functions → Functions → timebuzzer-sync → Logs
4. **Of de secret bestaat** (check Edge Functions → Secrets)

---

## Belangrijkste Regels:

1. ⚠️ **Secret MOET bestaan** voordat de functie werkt
2. ⚠️ **Functie MOET worden gedeployed** na het toevoegen van een secret
3. ⚠️ **Functie naam MOET exact zijn**: `timebuzzer-sync`
4. ⚠️ **Secret naam MOET exact zijn**: `TIMEBUZZER_API_KEY`








