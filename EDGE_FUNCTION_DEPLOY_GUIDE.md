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

## Stap 4: Environment Variabelen Instellen

### Optie A: Via Supabase Dashboard (Aanbevolen)

1. Ga naar je **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Project Settings** → **Edge Functions**
4. Klik op **Manage secrets**
5. Voeg de volgende secrets toe:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://bgddtkiekjcdhcmrnxsi.supabase.co`
   - (Vervang met je eigen Supabase URL)

   **Secret 2:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (Je service_role key - zie hieronder hoe je die vindt)

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

## Stap 5: Edge Function Deployen

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

## Stap 6: Supabase Email Configureren

### 6.1 Email Templates Controleren

1. Ga naar **Authentication** → **Email Templates**
2. Controleer of de **"Invite user"** template actief is
3. Optioneel: Pas de template aan met je eigen branding

### 6.2 SMTP Settings Configureren

**Optie A: Supabase Default Email (Gratis, maar beperkt)**

1. Ga naar **Project Settings** → **Auth** → **SMTP Settings**
2. Supabase gebruikt standaard hun eigen email service
3. Dit werkt automatisch, maar heeft beperkingen:
   - Max 3 emails per uur (gratis plan)
   - Max 4 emails per uur (Pro plan)
   - Emails kunnen in spam terechtkomen

**Optie B: Custom SMTP (Aanbevolen voor productie)**

1. Ga naar **Project Settings** → **Auth** → **SMTP Settings**
2. Schakel **"Enable Custom SMTP"** in
3. Vul je SMTP gegevens in:

   **Voor Gmail:**
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: `jouw-email@gmail.com`
   - Password: (App Password - zie hieronder)
   - Sender email: `jouw-email@gmail.com`
   - Sender name: `BAMPRO MARINE`

   **Voor andere providers:**
   - Check de documentatie van je email provider voor SMTP instellingen

### Gmail App Password Aanmaken:

1. Ga naar je Google Account: https://myaccount.google.com/
2. Ga naar **Security** → **2-Step Verification** (moet aan staan)
3. Scroll naar **App passwords**
4. Maak een nieuwe app password aan voor "Mail"
5. Gebruik dit wachtwoord in Supabase SMTP settings

---

## Stap 7: Testen

1. Log in op je website als admin
2. Ga naar **Admin Panel**
3. Voeg een nieuwe gebruiker toe met een email adres
4. Controleer of je een email ontvangt

### Troubleshooting:

**Geen email ontvangen?**
- Check je spam/junk folder
- Controleer Supabase Dashboard → **Logs** → **Edge Functions** voor errors
- Controleer of SMTP correct is geconfigureerd
- Test met een ander email adres

**Edge Function error?**
- Check of alle environment variabelen zijn ingesteld
- Controleer of de service_role key correct is
- Kijk in Supabase Dashboard → **Logs** → **Edge Functions**

**"Function not found" error?**
- Zorg dat je de Edge Function hebt gedeployed
- Check of de function URL correct is: `{SUPABASE_URL}/functions/v1/invite-user`

---

## Stap 8: Verificatie

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

📧 **Email Limits:**
- Gratis plan: 3 emails/uur
- Pro plan: 4 emails/uur
- Met custom SMTP: afhankelijk van je provider

🔧 **Onderhoud:**
- Update de Edge Function na code wijzigingen
- Check regelmatig de logs voor errors
- Test email functionaliteit na Supabase updates

---

## Hulp Nodig?

- **Supabase Docs:** https://supabase.com/docs/guides/functions
- **Supabase CLI Docs:** https://supabase.com/docs/reference/cli
- **Email Templates:** https://supabase.com/docs/guides/auth/auth-email-templates

