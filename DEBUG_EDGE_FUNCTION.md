# Debug: Edge Function Test

## Stap 1: Check Environment Variabelen

Open je browser console (F12) en typ:

```javascript
console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("Anon Key:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing");
```

**Verwacht resultaat:**
- Supabase URL: `https://bgddtkiekjcdhcmrnxsi.supabase.co`
- Anon Key: `✅ Set`

## Stap 2: Test Edge Function Direct

In browser console (F12), typ:

```javascript
fetch("https://bgddtkiekjcdhcmrnxsi.supabase.co/functions/v1/invite-user", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer JE_ANON_KEY_HIER"
  },
  body: JSON.stringify({
    email: "test@example.com",
    name: "Test User",
    isAdmin: false
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Vervang `JE_ANON_KEY_HIER` met je echte anon key!**

**Mogelijke resultaten:**
- `{success: true}` → Edge Function werkt!
- `{error: "..."}` → Edge Function error
- `404` → Function niet gedeployed
- `401/403` → Authentication probleem
- Network error → CORS of URL probleem

## Stap 3: Check Supabase Dashboard

1. Ga naar: https://supabase.com/dashboard
2. Selecteer project: `bgddtkiekjcdhcmrnxsi`
3. Ga naar **Edge Functions** → **Functions**
4. Staat `invite-user` in de lijst?
   - **NEE** → Volg `DEPLOY_EDGE_FUNCTION.md` om hem te deployen
   - **JA** → Ga naar **Logs** en check voor errors

## Stap 4: Check Supabase Logs

1. Ga naar **Edge Functions** → **Logs**
2. Klik op `invite-user`
3. Kijk naar recente logs
4. Welke errors zie je?

## Stap 5: Test Direct in Supabase Dashboard

1. Ga naar **Authentication** → **Users**
2. Klik op **"Invite user"** (rechtsboven)
3. Voer je email in
4. Klik **"Send invitation"**
5. **Krijg je WEL een email?**
   - **JA** → Supabase email werkt, maar Edge Function niet
   - **NEE** → Supabase email service probleem

## Veelvoorkomende Problemen

### Probleem 1: Edge Function niet gedeployed
**Symptoom:** 404 error in console
**Oplossing:** Deploy de function via Supabase Dashboard

### Probleem 2: Verkeerde anon key
**Symptoom:** 401/403 error
**Oplossing:** Check `.env.local` of Netlify environment variables

### Probleem 3: Email al geregistreerd
**Symptoom:** "already registered" error
**Oplossing:** Verwijder user uit Supabase Auth → Users, of gebruik ander email

### Probleem 4: CORS probleem
**Symptoom:** Network error of CORS error
**Oplossing:** Check of Edge Function CORS headers heeft (zou automatisch moeten)

### Probleem 5: Edge Function error
**Symptoom:** 500 error
**Oplossing:** Check Supabase logs voor details




















