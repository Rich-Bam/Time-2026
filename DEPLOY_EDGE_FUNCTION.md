# Edge Function Deployen - Snelle Handleiding

## Probleem
Je krijgt de melding "Let op: er is geen email verstuurd" wanneer je iemand uitnodigt via het Admin Panel.

## Oplossing: Deploy de Edge Function

### Stap 1: Ga naar Supabase Dashboard
1. Open: https://supabase.com/dashboard
2. Selecteer je project (`bgddtkiekjcdhcmrnxsi`)

### Stap 2: Check of Edge Function bestaat
1. Ga naar **Edge Functions** → **Functions**
2. Zoek naar `invite-user` in de lijst

### Stap 3A: Als de function NIET bestaat - Maak hem aan
1. Klik op **"Create new edge function"** (of **"New function"**)
2. Function name: `invite-user`
3. Kopieer ALLE code uit: `time-track-teamwork-excel-main/supabase/functions/invite-user/index.ts`
4. Plak de code in de editor
5. Klik op **"Deploy function"** (of **"Deploy"**)

### Stap 3B: Als de function WEL bestaat - Update hem
1. Klik op `invite-user` in de lijst
2. Klik op **"Edit"** of **"Update"**
3. Kopieer ALLE code uit: `time-track-teamwork-excel-main/supabase/functions/invite-user/index.ts`
4. Vervang de oude code met de nieuwe code
5. Klik op **"Deploy function"** (of **"Save"**)

### Stap 4: Voeg APP_URL secret toe (optioneel, maar aanbevolen)
1. Ga naar **Edge Functions** → **Secrets** (of **Project Settings** → **Edge Functions** → **Secrets**)
2. Klik op **"Add new secret"**
3. Name: `APP_URL`
4. Value: `https://bampro-uren.nl` (of je eigen website URL)
5. Klik op **"Save"**

**Let op:** Als je `APP_URL` niet instelt, gebruikt de function standaard `https://bampro-uren.nl`.

### Stap 5: Test
1. Ga terug naar je website
2. Log in als admin
3. Ga naar **Admin Panel**
4. Nodig jezelf opnieuw uit
5. Check je email (ook spam folder!)

## Troubleshooting

### Geen email ontvangen?
1. **Check browser console (F12)** → Zie je errors?
2. **Check Supabase logs:**
   - Ga naar **Edge Functions** → **Logs**
   - Klik op `invite-user`
   - Welke errors staan er?
3. **Check of email al bestaat:**
   - Ga naar **Authentication** → **Users**
   - Staat je email er al in?
   - Als ja: verwijder de user eerst, of gebruik een ander email adres
4. **Check spam folder** - Supabase emails kunnen in spam terechtkomen

### Edge Function geeft error?
- **404 Not Found** → Function is niet gedeployed (volg Stap 3A)
- **401 Unauthorized** → Check of je de juiste anon key gebruikt in `.env.local`
- **500 Internal Server Error** → Check Supabase logs voor details

### Email link gaat naar localhost?
- Dit betekent dat Supabase de verkeerde redirect URL gebruikt
- Voeg `APP_URL` secret toe (Stap 4)
- Of update de redirect URL in Supabase Dashboard → **Authentication** → **URL Configuration**

## Belangrijk

✅ **SUPABASE_URL** en **SUPABASE_SERVICE_ROLE_KEY** zijn automatisch beschikbaar - hoef je NIET handmatig toe te voegen!

✅ De Edge Function gebruikt Supabase's eigen email service - geen Resend of andere services nodig!

✅ Als je direct via Supabase Dashboard een invite stuurt en je krijgt WEL een email, dan werkt Supabase email service. Het probleem is alleen dat de Edge Function niet gedeployed is.




