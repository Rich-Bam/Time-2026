# Timebuzzer Users Ophalen - Stap voor Stap

## Wat moet je doen?

Je hebt nu een nieuwe functie om **alle Timebuzzer users** op te halen. Volg deze stappen:

## Stap 1: Deploy de Edge Function

### Optie A: Via Supabase Dashboard (Aanbevolen)

1. Ga naar je **Supabase Dashboard**
2. Navigate naar **Edge Functions**
3. Klik op **"Create a new function"** of zoek naar **"timebuzzer-sync"**
4. Als de function al bestaat, klik op **"Deploy"** of **"Update"**
5. Als de function niet bestaat:
   - Klik op **"Create a new function"**
   - Naam: `timebuzzer-sync`
   - Kopieer de inhoud van `supabase/functions/timebuzzer-sync/index.ts`
   - Plak in de editor
   - Klik op **"Deploy"**

### Optie B: Via Command Line

```bash
# Ga naar je project folder
cd time-track-teamwork-excel-main

# Deploy de function
supabase functions deploy timebuzzer-sync
```

## Stap 2: Controleer API Key

1. Ga naar **Supabase Dashboard**
2. Navigate naar **Edge Functions** → **Settings** → **Environment Variables**
3. Controleer of `TIMEBUZZER_API_KEY` bestaat
4. Als deze niet bestaat:
   - Klik op **"Add new variable"**
   - Name: `TIMEBUZZER_API_KEY`
   - Value: Je Timebuzzer API key (haal deze op van my.timebuzzer.com → Settings → API)

## Stap 3: Test in Admin Panel

1. **Log in** op je applicatie als super admin
2. Ga naar **Admin Panel**
3. Klik op de **"Timebuzzer"** tab (rechtsboven in de tabs)
4. Scroll naar beneden tot je de knop ziet: **"Fetch All Timebuzzer Users"**
5. Klik op deze knop
6. Wacht even (je ziet "Loading...")
7. Als het werkt, zie je een tabel met alle Timebuzzer users

## Wat zie je in de tabel?

De tabel toont:
- **ID**: Timebuzzer user ID (gebruik dit voor mapping)
- **Name**: Naam van de user
- **Email**: Email van de user
- **Mapped To**: Of de user al gemapt is naar een lokale user
  - ✓ Groen = Al gemapt
  - Oranje = Nog niet gemapt

## Stap 4: Users Mappen (Optioneel)

Als je users wilt mappen:

1. Kijk in de tabel welke users nog niet gemapt zijn (oranje)
2. Noteer de **ID** van de Timebuzzer user
3. Gebruik deze SQL query in Supabase SQL Editor:

```sql
UPDATE users 
SET timebuzzer_user_id = '123'  -- Vervang met de ID uit de tabel
WHERE email = 'user@example.com';  -- Vervang met het email van je lokale user
```

## Troubleshooting

### Error: "TIMEBUZZER_API_KEY environment variable is not set"
- **Oplossing**: Zorg dat de API key is ingesteld in Supabase Dashboard (zie Stap 2)

### Error: "Timebuzzer API returned HTML instead of JSON"
- **Mogelijke oorzaken**:
  1. API key is ongeldig of verlopen
  2. Het API endpoint klopt niet
  3. Je hebt geen toegang tot de users endpoint

- **Oplossingen**:
  1. Check je API key in Timebuzzer Settings → API
  2. Genereer een nieuwe API key als nodig
  3. Check de Timebuzzer API documentatie voor het juiste endpoint

### Geen users gevonden
- **Mogelijke oorzaken**:
  1. Er zijn geen users in Timebuzzer
  2. De API key heeft geen toegang tot users
  3. Het endpoint geeft een andere response format

- **Oplossingen**:
  1. Check de browser console voor error details
  2. Check de Timebuzzer API documentatie
  3. Pas de edge function aan als het response format anders is

## Belangrijk

De edge function gebruikt het endpoint: `https://my.timebuzzer.com/open-api/users`

Als dit niet het juiste endpoint is volgens de Timebuzzer API documentatie, moet je dit aanpassen in:
`supabase/functions/timebuzzer-sync/index.ts` (regel ~50)

## Klaar!

Na het volgen van deze stappen kun je:
- ✅ Alle Timebuzzer users zien
- ✅ Zien welke users al gemapt zijn
- ✅ Users mappen naar je lokale database

