# Deployment Fix: 406 Error in Production

## Probleem
De applicatie werkt wel op localhost maar niet in productie. Gebruikers krijgen een 406 (Not Acceptable) error bij het inloggen.

## Oorzaak
De Supabase REST API vereist specifieke headers (`Accept` en `Content-Type`) die niet altijd correct worden meegestuurd door de Supabase client, vooral in productie builds.

## Oplossing
De Supabase client is geconfigureerd met expliciete headers die altijd worden meegestuurd, zowel in development als production.

## Wat is aangepast
1. **Supabase Client Configuratie** (`src/integrations/supabase/client.ts`):
   - Expliciete `Accept: application/json` header
   - Expliciete `Content-Type: application/json` header
   - Expliciete `apikey` header voor authenticatie
   - Schema expliciet ingesteld op 'public'

## Deployment Stappen

### 1. Rebuild de Applicatie
```bash
npm run build
```

### 2. Deploy naar Productie
- Als je Netlify gebruikt: push naar git repository (auto-deploy)
- Als je Vercel gebruikt: push naar git repository (auto-deploy)
- Als je handmatig deployt: upload de `dist` folder naar je hosting

### 3. Verificatie na Deployment
1. Open de productie website
2. Open browser console (F12)
3. Probeer in te loggen
4. Controleer of er geen 406 errors meer zijn
5. Controleer of login succesvol is

## Voorkomen van Toekomstige Problemen

### Environment Variabelen Controleren
Zorg dat deze environment variabelen zijn ingesteld in je hosting platform:

**Voor Netlify:**
1. Ga naar Site settings → Environment variables
2. Voeg toe:
   - `VITE_SUPABASE_URL` = `https://bgddtkiekjcdhcmrnxsi.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (je anon key)

**Voor Vercel:**
1. Ga naar Project settings → Environment Variables
2. Voeg toe:
   - `VITE_SUPABASE_URL` = `https://bgddtkiekjcdhcmrnxsi.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (je anon key)

**Voor andere hosting:**
- Zorg dat `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` beschikbaar zijn tijdens build time

### Cache Clearing
Na deployment, clear de browser cache:
- Hard refresh: `Ctrl+Shift+R` (Windows) of `Cmd+Shift+R` (Mac)
- Of gebruik incognito/private browsing mode

### Monitoring
Controleer regelmatig:
- Browser console voor errors
- Network tab voor failed requests
- Supabase logs voor API errors

## Troubleshooting

### Als het nog steeds niet werkt:

1. **Check Supabase Client Versie**
   ```bash
   npm list @supabase/supabase-js
   ```
   Zorg dat je versie 2.50.0 of hoger gebruikt

2. **Check Build Output**
   - Controleer of de nieuwe client.ts code in de build zit
   - Zoek in `dist/assets/` naar de compiled JavaScript
   - Controleer of de headers configuratie aanwezig is

3. **Check Network Requests**
   - Open Network tab in browser
   - Kijk naar de request headers van failed requests
   - Controleer of `Accept: application/json` aanwezig is

4. **Check Supabase Dashboard**
   - Ga naar Supabase Dashboard → API → Settings
   - Controleer of RLS policies correct zijn ingesteld
   - Controleer of de anon key nog geldig is

## Contact
Als het probleem aanhoudt na deze stappen, controleer:
- Supabase project status
- API rate limits
- RLS policies op users table

