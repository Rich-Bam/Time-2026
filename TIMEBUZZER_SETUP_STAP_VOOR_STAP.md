# Timebuzzer Integration - Stap voor Stap Handleiding

## Stap 1: API Key Toevoegen aan Supabase Secrets

1. **Ga naar Supabase Dashboard**
   - Open https://supabase.com/dashboard
   - Selecteer je project: `Timer-tracker-2026`

2. **Ga naar Edge Functions → Secrets**
   - Klik in de linker sidebar op **"Edge Functions"**
   - Klik op **"Secrets"** (onder "MANAGE")

3. **Voeg de Secret toe**
   - Klik op de knop **"Add secret"** of **"New secret"**
   - Vul in:
     - **Name:** `TIMEBUZZER_API_KEY`
     - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI`
   - Klik op **"Save"** of **"Add"**

   **✅ Check:** Je zou nu `TIMEBUZZER_API_KEY` moeten zien in de lijst met secrets

---

## Stap 2: Deploy de Edge Function (via Dashboard)

1. **Ga naar Edge Functions → Functions**
   - Klik in de linker sidebar op **"Edge Functions"**
   - Klik op **"Functions"** (onder "MANAGE")

2. **Zoek de timebuzzer-sync functie**
   - Scroll naar beneden in de functies lijst
   - Zoek naar **"timebuzzer-sync"**
   - Klik op de naam **"timebuzzer-sync"** om de details te openen

3. **Redeploy de functie**
   - In de functie detail pagina, klik op de knop **"Redeploy"** of **"Deploy"**
   - Wacht tot de deploy klaar is (je ziet meestal "Deployment successful" of een groene vink)

   **✅ Check:** In de "UPDATED" kolom zou de tijd moeten updaten naar "just now" of "a few seconds ago"

---

## Stap 3: Deploy via CLI (Alternatief - Als Dashboard niet werkt)

Als je de CLI wilt gebruiken:

1. **Open Terminal/PowerShell**
   - Ga naar de project folder: `c:\time-track-teamwork-excel-main`

2. **Login bij Supabase** (als je nog niet ingelogd bent)
   ```powershell
   npx supabase login
   ```
   - Dit opent een browser waar je in kunt loggen

3. **Link het project** (als je dit nog niet hebt gedaan)
   ```powershell
   npx supabase link --project-ref bgddtkiekjcdhcmrnxsi
   ```
   - Vervang `bgddtkiekjcdhcmrnxsi` met je project reference als die anders is

4. **Deploy de functie**
   ```powershell
   npx supabase functions deploy timebuzzer-sync
   ```

5. **Set de secret via CLI** (als je het niet via Dashboard hebt gedaan)
   ```powershell
   npx supabase secrets set TIMEBUZZER_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI
   ```

---

## Stap 4: Test de API

1. **Ga naar je website**
   - Open je time tracking website
   - Log in als admin

2. **Ga naar Admin Panel**
   - Klik op **"Admin Panel"** in de navigatie

3. **Scroll naar beneden naar "Timebuzzer Integration"**
   - Je zou een groene sectie moeten zien met de titel "Timebuzzer Integration"

4. **Klik op "Test API"**
   - Dit is de oranje knop naast "Sync from Timebuzzer"
   - **Wacht een paar seconden**

5. **Check het resultaat:**
   - **Als het werkt:** Je ziet een groene notificatie met "API Test Successful"
   - **Als het niet werkt:** 
     - Open de browser console (druk op F12 → klik op "Console" tab)
     - Zoek naar error messages die beginnen met "Test API Error:" of "Response:"
     - Deel deze error met me

---

## Stap 5: Verificatie - Check of alles werkt

Om zeker te zijn dat alles correct is ingesteld:

### Check 1: Secret bestaat
- Ga naar Supabase Dashboard → Edge Functions → Secrets
- Je zou `TIMEBUZZER_API_KEY` moeten zien in de lijst
- ✅ Als het er staat: Goed!
- ❌ Als het er niet staat: Ga terug naar Stap 1

### Check 2: Functie is gedeployed
- Ga naar Supabase Dashboard → Edge Functions → Functions
- Zoek `timebuzzer-sync`
- Kijk naar "UPDATED" kolom - dit zou recent moeten zijn (minuten/uren geleden)
- ✅ Als het recent is: Goed!
- ❌ Als het oud is (> 1 dag): Ga terug naar Stap 2

### Check 3: Browser Console
- Open je website → Admin Panel
- Druk op F12 → Console tab
- Klik op "Test API"
- In de console zou je moeten zien:
  - `Testing Timebuzzer API...`
  - `Response: { data: {...}, error: ... }`
- ✅ Als je `error: null` ziet: Perfect!
- ❌ Als je een error ziet: Noteer de exacte error message

---

## Troubleshooting

### Probleem: "Failed to send a request to the Edge Function"

**Oplossing 1:** Check of de secret bestaat
- Ga naar Supabase Dashboard → Edge Functions → Secrets
- Check of `TIMEBUZZER_API_KEY` in de lijst staat

**Oplossing 2:** Redeploy de functie
- De functie moet opnieuw gedeployed worden NA het toevoegen van de secret
- Ga naar Edge Functions → Functions → timebuzzer-sync → Redeploy

**Oplossing 3:** Check browser console
- Druk F12 → Console tab
- Klik op "Test API"
- Kijk wat er in de console staat onder "Test API Error:"

**Oplossing 4:** Check Edge Function logs
- Ga naar Supabase Dashboard → Edge Functions → Functions → timebuzzer-sync
- Klik op "Logs" tab
- Kijk of er errors staan

### Probleem: "TIMEBUZZER_API_KEY not configured"

**Oplossing:**
- De secret is niet correct ingesteld
- Ga terug naar Stap 1 en voeg de secret toe
- **BELANGRIJK:** Redeploy de functie daarna (Stap 2)

---

## Belangrijke Punten

⚠️ **LET OP:**
- De secret moet **exact** de naam `TIMEBUZZER_API_KEY` hebben (hoofdletters, underscores)
- De API key waarde moet **exact** worden overgenomen (inclusief alle tekens)
- Na het toevoegen van een secret, moet je de Edge Function **opnieuw deployen**
- Als je de secret via CLI toevoegt, hoef je niet opnieuw te deployen (dit gebeurt automatisch)

---

## Volgende Stappen (na succesvolle test)

Als de "Test API" knop werkt:

1. **Map Users** - Voeg `timebuzzer_user_id` toe aan je users in de database
2. **Map Projects** - Voeg `timebuzzer_project_id` toe aan je projects in de database
3. **Test Sync** - Gebruik de "Sync from Timebuzzer" knop met start en end dates

Voor meer details, zie `TIMEBUZZER_INTEGRATION.md`




