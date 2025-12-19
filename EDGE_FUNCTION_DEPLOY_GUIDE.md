# Handleiding: Edge Function Deployen voor Email Uitnodigingen

Deze handleiding legt uit hoe je de `invite-user` Edge Function deployt zodat gebruikers uitnodigingsemails ontvangen.

## Vereisten

1. **Supabase CLI** geïnstalleerd
2. **Toegang tot je Supabase project**
3. **Service Role Key** van je Supabase project

---

## Stap 1: Supabase CLI Installeren

### Windows (PowerShell):
```powershell
# Via npm (als je Node.js hebt)
npm install -g supabase

# Of via Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Mac/Linux:
```bash
brew install supabase/tap/supabase
```

### Verificatie:
```bash
supabase --version
```

---

## Stap 2: Login bij Supabase

```bash
supabase login
```

Dit opent je browser. Log in met je Supabase account.

---

## Stap 3: Link naar je Project

```bash
cd C:\time-track-teamwork-excel-main\time-track-teamwork-excel-main
supabase link --project-ref bgddtkiekjcdhcmrnxsi
```

**Let op:** Vervang `bgddtkiekjcdhcmrnxsi` met je eigen project reference als die anders is.

Je project reference vind je in:
- Supabase Dashboard → Project Settings → General → Reference ID

---

## Stap 4: Resend API Key Aanmaken

1. Ga naar **Resend**: https://resend.com
2. Maak een account aan (gratis plan beschikbaar)
3. Ga naar **API Keys**: https://resend.com/api-keys
4. Klik op **Create API Key**
5. Geef het een naam (bijv. "BAMPRO Timesheet")
6. Kopieer de API key (je ziet hem maar één keer!)

**Resend Gratis Plan:**
- 3,000 emails per maand
- 100 emails per dag
- Goede deliverability
- Transactional emails

## Stap 5: Environment Variabelen Instellen

### Via Supabase Dashboard (Aanbevolen)

1. Ga naar je **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Edge Functions** → **Secrets** (of **Project Settings** → **Edge Functions** → **Manage secrets**)
4. Klik op **Add new secret** en voeg de volgende secrets toe:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://bgddtkiekjcdhcmrnxsi.supabase.co`
   - (Vervang met je eigen Supabase URL)

   **Secret 2:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (Je service_role key - zie hieronder hoe je die vindt)

   **Secret 3:**
   - Name: `RESEND_API_KEY`
   - Value: (Je Resend API key van stap 4)

   **Secret 4 (Optioneel):**
   - Name: `RESEND_FROM_EMAIL`
   - Value: `noreply@bampro.nl` (of je eigen verified email in Resend)
   - **Let op:** Je moet deze email eerst verifiëren in Resend!

   **Secret 5 (Optioneel):**
   - Name: `APP_URL`
   - Value: `https://bampro-uren.nl` (je website URL voor login links)

### Service Role Key vinden:

1. Ga naar **Project Settings** → **API**
2. Scroll naar **Project API keys**
3. Kopieer de **`service_role`** key (NIET de `anon` key!)
4. ⚠️ **BELANGRIJK:** Deze key geeft volledige toegang - deel deze NOOIT publiekelijk!

### Optie B: Via Supabase CLI

```bash
supabase secrets set SUPABASE_URL=https://bgddtkiekjcdhcmrnxsi.supabase.co --project-ref bgddtkiekjcdhcmrnxsi
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here --project-ref bgddtkiekjcdhcmrnxsi
```

---

## Stap 6: Email Verifiëren in Resend

1. Ga naar **Resend** → **Domains**: https://resend.com/domains
2. Voeg je domein toe (bijv. `bampro.nl`) of gebruik een verified email
3. Volg de DNS instructies om je domein te verifiëren
4. **Alternatief:** Gebruik een verified email adres (bijv. Gmail) voor `RESEND_FROM_EMAIL`

## Stap 7: Edge Function Deployen

```bash
cd C:\time-track-teamwork-excel-main\time-track-teamwork-excel-main
supabase functions deploy invite-user --project-ref bgddtkiekjcdhcmrnxsi
```

Als alles goed gaat, zie je:
```
Deploying function invite-user...
Function invite-user deployed successfully
```

---

---

## Stap 8: Testen

1. Log in op je website als admin
2. Ga naar **Admin Panel**
3. Voeg een nieuwe gebruiker toe met een email adres
4. Controleer of je een email ontvangt

### Troubleshooting:

**Geen email ontvangen?**
- Check je spam/junk folder
- Controleer Supabase Dashboard → **Logs** → **Edge Functions** voor errors
- Controleer Resend Dashboard → **Emails** voor email status
- Verifieer dat `RESEND_API_KEY` correct is ingesteld
- Controleer of `RESEND_FROM_EMAIL` geverifieerd is in Resend
- Test met een ander email adres

**Edge Function error?**
- Check of alle environment variabelen zijn ingesteld
- Controleer of de service_role key correct is
- Kijk in Supabase Dashboard → **Logs** → **Edge Functions**

**"Function not found" error?**
- Zorg dat je de Edge Function hebt gedeployed
- Check of de function URL correct is: `{SUPABASE_URL}/functions/v1/invite-user`

---

## Stap 9: Verificatie

Na succesvol deployen zou je moeten kunnen:

1. ✅ Een gebruiker uitnodigen via Admin Panel
2. ✅ Een email ontvangen met uitnodigingslink
3. ✅ De gebruiker kan zich aanmelden via de link in de email

---

## Handige Commands

```bash
# Check Edge Functions status
supabase functions list --project-ref bgddtkiekjcdhcmrnxsi

# View Edge Function logs
supabase functions logs invite-user --project-ref bgddtkiekjcdhcmrnxsi

# Update Edge Function (na code wijzigingen)
supabase functions deploy invite-user --project-ref bgddtkiekjcdhcmrnxsi

# Delete Edge Function (als je het niet meer nodig hebt)
supabase functions delete invite-user --project-ref bgddtkiekjcdhcmrnxsi
```

---

## Belangrijke Notities

⚠️ **Security:**
- Deel de `service_role` key NOOIT publiekelijk
- Gebruik environment variabelen, niet hardcoded keys
- De Edge Function gebruikt de service_role key veilig server-side

📧 **Email Limits (Resend):**
- Gratis plan: 3,000 emails/maand, 100 emails/dag
- Pro plan: 50,000+ emails/maand
- Goede deliverability (minder spam)
- Transactional emails geoptimaliseerd

🔧 **Onderhoud:**
- Update de Edge Function na code wijzigingen
- Check regelmatig de logs voor errors
- Test email functionaliteit na Supabase updates

---

## Hulp Nodig?

- **Supabase Docs:** https://supabase.com/docs/guides/functions
- **Supabase CLI Docs:** https://supabase.com/docs/reference/cli
- **Email Templates:** https://supabase.com/docs/guides/auth/auth-email-templates

