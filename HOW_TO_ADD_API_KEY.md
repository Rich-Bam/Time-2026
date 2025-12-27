# How to Add Timebuzzer API Key to Supabase

## Step-by-Step Instructions

### 1. Go to Edge Functions → Secrets

1. In Supabase Dashboard, ga naar **Edge Functions** (in de linkersidebar)
2. Klik op **"Secrets"** (onder "MANAGE" sectie, naast "Functions")

### 2. Add the API Key as a Secret

1. Klik op **"Add secret"** of **"New secret"** knop
2. Vul in:
   - **Name**: `TIMEBUZZER_API_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI`
3. Klik op **"Save"** of **"Add"**

### Alternative: Via Settings → Environment Variables

Als je "Secrets" niet ziet, probeer dan:

1. Ga naar **Edge Functions** → **Settings** (rechtsboven of in de sidebar)
2. Ga naar **Environment Variables** of **Secrets** tab
3. Klik op **"Add new secret"**
4. Voeg toe:
   - **Name**: `TIMEBUZZER_API_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InIuYmxhbmNlQGJhbXByby5ubCIsInRzIjoiMjAyNS0xMi0yMFQyMDo1MToxOS4xMTZaIiwiaWF0IjoxNzY2MjYzODc5fQ.m370b-EdhA7Vl0pEkjFqyEsDNPs1oipwG4xCkNZiLEI`

## Verify

Na het toevoegen:
1. Ga terug naar **Edge Functions** → **Functions** → **timebuzzer-sync**
2. Klik op **"Test"** tab of gebruik de "Invoke function" sectie
3. Test de functie met: `{"action": "test-api"}`
4. Of test vanuit je Admin Panel door op "Test API" te klikken

## Important Notes

- De API key is nu opgeslagen als een **Secret** in Supabase
- Deze is alleen beschikbaar binnen Edge Functions (niet in de client)
- Na het toevoegen kan het even duren voordat de functie de nieuwe secret ziet
- Als het niet werkt, probeer de functie opnieuw te deployen

















