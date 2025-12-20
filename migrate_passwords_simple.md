# Snelste Manier: Hash Alle Wachtwoorden Direct

## Optie 1: Edge Function (Aanbevolen)

### Stap 1: Deploy Edge Function

1. Ga naar **Supabase Dashboard** → **Edge Functions**
2. Klik **Create a new function**
3. Naam: `hash-all-passwords`
4. Kopieer de inhoud van `supabase/functions/hash-all-passwords/index.ts`
5. Plak in de editor
6. Klik **Deploy**

### Stap 2: Run de Function

1. Ga naar **Edge Functions** → **hash-all-passwords**
2. Klik **Invoke**
3. Method: **POST**
4. Body: `{}`
5. Klik **Invoke function**

### Stap 3: Controleer Resultaat

Run deze SQL query:
```sql
SELECT 
  email,
  CASE 
    WHEN password LIKE '$2%' THEN 'hashed ✅'
    ELSE 'plaintext ⚠️'
  END as status
FROM users;
```

Alle wachtwoorden zouden nu `hashed ✅` moeten zijn!

---

## Optie 2: Lokaal Script (Alternatief)

Als de Edge Function niet werkt, kun je een lokaal Node.js script draaien:

1. Installeer dependencies: `npm install dotenv`
2. Zorg dat je `.env.local` bestand je Supabase credentials heeft:
   ```
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_key
   ```
3. Run: `node migrate-passwords.mjs`

**Let op:** Je hebt je Supabase Service Role Key nodig (niet de anon key!)

---

## Optie 3: Wacht op Automatische Migratie

Wachtwoorden worden automatisch gehashed wanneer gebruikers inloggen. Dit betekent:
- ⚠️ Wachtwoorden blijven plaintext tot elke gebruiker inlogt
- ✅ Geen actie nodig van jou
- ⏱️ Kan lang duren als gebruikers niet vaak inloggen

**Aanbevolen:** Gebruik Optie 1 (Edge Function) voor directe beveiliging!

