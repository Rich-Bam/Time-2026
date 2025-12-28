# Fix Invite User - Stap voor Stap

Je krijgt nog steeds CORS en RLS errors. Volg deze stappen in volgorde:

## Stap 1: Voer RLS Fix SQL Script Uit (BELANGRIJK!)

1. **Open Supabase Dashboard** → **SQL Editor**
2. **Kopieer ALLE code** uit `fix_invite_user_rls.sql`
3. **Plak** in de SQL Editor
4. **Klik op "Run"** (of druk F5)
5. **Check of je ziet:**
   - ✅ "Service role can insert users" policy
   - ✅ "Admins can insert users via Edge Function" policy
   - ✅ Geen errors

**Als je errors ziet**, deel de error message en ik help je fixen.

## Stap 2: Deploy Edge Function met Nieuwe Code

1. **Open Supabase Dashboard** → **Edge Functions** → **Functions**
2. **Klik op `invite-user`** (of maak nieuwe aan als die niet bestaat)
3. **Kopieer ALLE code** uit `supabase/functions/invite-user/index.ts`
4. **Plak** in de code editor (vervang ALLES)
5. **Klik op "Deploy"** of "Redeploy"
6. **Wacht** tot deployment klaar is (10-30 seconden)
7. **Check** dat "UPDATED" tijd recent is ("just now" of "1 minute ago")

## Stap 3: Push Code naar GitHub (als nog niet gedaan)

De AdminPanel code is aangepast om direct `fetch` te gebruiken. Als je lokaal werkt:

1. **Commit en push** de wijzigingen:
   ```bash
   git add src/components/AdminPanel.tsx
   git commit -m "Fix invite-user CORS door direct fetch te gebruiken"
   git push
   ```

2. **Wacht** tot Netlify/Vercel deployment klaar is (als je CI/CD hebt)

## Stap 4: Refresh Website

1. **Hard refresh** de website:
   - **Chrome/Edge:** Ctrl+Shift+R of Ctrl+F5
   - **Firefox:** Ctrl+Shift+R
   - **Safari:** Cmd+Shift+R

2. **Check** of de nieuwe code geladen is:
   - Open **Browser Console** (F12)
   - Kijk of je ziet: `"🔵 Calling invite-user Edge Function..."`
   - Je zou NIET meer moeten zien: `supabase.functions.invoke('invite-user')`

## Stap 5: Test Opnieuw

1. **Probeer** een nieuwe user aan te maken
2. **Check** Browser Console voor errors
3. **Als je nog errors ziet:**
   - Deel de exacte error message
   - Check of Edge Function gedeployed is (Stap 2)
   - Check of SQL script uitgevoerd is (Stap 1)

## Troubleshooting

### Error: "cache-control is not allowed"
**Oorzaak:** Edge Function is niet gedeployed met nieuwe CORS headers
**Oplossing:** Volg Stap 2 opnieuw, zorg dat je ALLE code kopieert

### Error: "row-level security policy"
**Oorzaak:** SQL script is niet uitgevoerd
**Oplossing:** Volg Stap 1, check of policies zijn aangemaakt

### Error: "Failed to send a request"
**Oorzaak:** Edge Function bestaat niet of is niet gedeployed
**Oplossing:** Check Supabase Dashboard → Edge Functions → Functions → `invite-user` bestaat

### Error: "401 Unauthorized"
**Oorzaak:** RLS policy blokkeert insert
**Oplossing:** Voer Stap 1 opnieuw uit, check of `service_role` policy bestaat

## Checklist

Voordat je test, check:

- [ ] SQL script uitgevoerd (Stap 1)
- [ ] Edge Function gedeployed (Stap 2)
- [ ] AdminPanel code gepusht (Stap 3)
- [ ] Website gerefreshed (Stap 4)
- [ ] Browser Console geopend om errors te zien

Als alles is aangevinkt en je nog steeds errors ziet, deel:
1. Screenshot van Browser Console errors
2. Screenshot van Supabase Edge Functions → Functions → `invite-user` (laat zien dat het gedeployed is)
3. Screenshot van SQL Editor na het uitvoeren van het script (laat zien dat policies zijn aangemaakt)

