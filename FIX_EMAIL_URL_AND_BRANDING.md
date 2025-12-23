# Fix: Email URL en Branding

## Probleem 1: Email link gaat naar localhost:3000

De email link moet naar `https://bampro-uren.nl` gaan, niet naar `localhost:3000`.

### Oplossing: Voeg APP_URL secret toe aan Edge Function

1. Ga naar **Supabase Dashboard** → **Edge Functions** → **Secrets**
   - Of: **Project Settings** → **Edge Functions** → **Secrets**

2. Klik op **"Add new secret"** of **"New secret"**

3. Vul in:
   - **Name:** `APP_URL`
   - **Value:** `https://bampro-uren.nl`
   - (Of je eigen website URL als die anders is)

4. Klik op **"Save"** of **"Add secret"**

5. **Re-deploy de Edge Function:**
   - Ga naar **Edge Functions** → **Functions** → `invite-user`
   - Klik op **"Deploy function"** opnieuw (zodat de secret wordt geladen)
   - Wacht tot deployment klaar is

6. **Test opnieuw:**
   - Nodig iemand uit via Admin Panel
   - Check of de email link nu naar `https://bampro-uren.nl` gaat

## Probleem 2: Email heeft geen branding/thema

De email template kan worden aangepast met je logo en kleuren.

### Oplossing: Pas Email Template aan in Supabase

1. Ga naar **Supabase Dashboard** → **Authentication** → **Email Templates**

2. Klik op **"Invite user"** template (of zoek naar "Invite")

3. Je ziet nu de email template editor met HTML code

4. **Pas de template aan** met je branding:

#### Optie A: Gebruik de aangepaste template hieronder

Kopieer deze template en plak in de Supabase editor:

```html
<h2>Je bent uitgenodigd voor BAMPRO MARINE</h2>

<p>Hallo,</p>

<p>Je bent uitgenodigd om een account aan te maken op <strong>BAMPRO MARINE</strong>.</p>

<p>Klik op de onderstaande link om je account te activeren:</p>

<p><a href="{{ .ConfirmationURL }}">Activeer Account</a></p>

<p>Deze link is 24 uur geldig.</p>

<p>Met vriendelijke groet,<br>
BAMPRO MARINE Team</p>

<hr>
<p style="color: #666; font-size: 12px;">
Je ontvangt deze email omdat je bent uitgenodigd voor een account op BAMPRO MARINE.<br>
Als je deze uitnodiging niet hebt aangevraagd, kun je deze email negeren.
</p>
```

#### Optie B: Voeg logo en styling toe

Voor een mooiere email met logo en kleuren, gebruik deze template:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #f97316;
    }
    .logo {
      max-width: 200px;
      height: auto;
      margin-bottom: 10px;
    }
    h1 {
      color: #f97316;
      margin: 0;
      font-size: 24px;
    }
    .button {
      display: inline-block;
      background-color: #f97316;
      color: #ffffff;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .button:hover {
      background-color: #ea580c;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      color: #666;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>BAMPRO MARINE</h1>
    </div>
    
    <h2>Je bent uitgenodigd!</h2>
    
    <p>Hallo,</p>
    
    <p>Je bent uitgenodigd om een account aan te maken op <strong>BAMPRO MARINE</strong>.</p>
    
    <p>Klik op de onderstaande knop om je account te activeren:</p>
    
    <p style="text-align: center;">
      <a href="{{ .ConfirmationURL }}" class="button">Activeer Account</a>
    </p>
    
    <p><strong>Let op:</strong> Deze link is 24 uur geldig.</p>
    
    <p>Na activatie kun je inloggen en beginnen met het bijhouden van je uren.</p>
    
    <div class="footer">
      <p>Met vriendelijke groet,<br>
      <strong>BAMPRO MARINE Team</strong></p>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
      
      <p style="color: #999; font-size: 11px;">
        Je ontvangt deze email omdat je bent uitgenodigd voor een account op BAMPRO MARINE.<br>
        Als je deze uitnodiging niet hebt aangevraagd, kun je deze email negeren.
      </p>
    </div>
  </div>
</body>
</html>
```

#### Optie C: Voeg je eigen logo toe

Als je een logo URL hebt:

1. Upload je logo naar een publiek toegankelijke locatie (bijv. je website: `https://bampro-uren.nl/bampro-marine-logo.jpg`)

2. Voeg deze regel toe in de template (in de `.header` sectie):

```html
<img src="https://bampro-uren.nl/bampro-marine-logo.jpg" alt="BAMPRO MARINE" class="logo">
```

### Stap 5: Sla de template op

1. Klik op **"Save"** of **"Update template"**
2. Test de template:
   - Ga naar **Authentication** → **Users** → **Invite user**
   - Nodig jezelf uit
   - Check of de email er nu mooi uitziet

## Belangrijk: Variabelen in Supabase Templates

Supabase gebruikt speciale variabelen in templates:

- `{{ .ConfirmationURL }}` - De activatie link (gebruik deze!)
- `{{ .Email }}` - Het email adres van de gebruiker
- `{{ .SiteURL }}` - De site URL (van Supabase configuratie)

**Let op:** Gebruik `{{ .ConfirmationURL }}` voor de activatie link, niet `{{ .SiteURL }}`!

## Test Checklist

Na het aanpassen:

- [ ] `APP_URL` secret is toegevoegd aan Edge Functions
- [ ] Edge Function is opnieuw gedeployed
- [ ] Email template is aangepast in Supabase
- [ ] Test email is verstuurd
- [ ] Email link gaat naar `https://bampro-uren.nl` (niet localhost)
- [ ] Email heeft branding/thema (logo, kleuren, etc.)

## Troubleshooting

### Email link gaat nog steeds naar localhost?

1. Check of `APP_URL` secret bestaat:
   - **Edge Functions** → **Secrets** → Check of `APP_URL` in de lijst staat
2. Check of Edge Function is re-deployed na het toevoegen van secret
3. Check Supabase Auth URL configuratie:
   - **Authentication** → **URL Configuration**
   - Check of **Site URL** is ingesteld op `https://bampro-uren.nl`
   - Check of **Redirect URLs** `https://bampro-uren.nl` bevat

### Email template wordt niet gebruikt?

1. Check of je de juiste template hebt aangepast (Invite user, niet Confirm signup)
2. Check of de template is opgeslagen (klik op Save)
3. Test met een nieuwe invite (oude emails gebruiken oude template)

### Logo wordt niet getoond?

1. Check of de logo URL publiek toegankelijk is (open in browser)
2. Check of de URL correct is (https://, niet http://)
3. Sommige email clients blokkeren externe images - dit is normaal

## Volgende Stappen

Na het aanpassen:
1. Test met een echte invite via Admin Panel
2. Check of alles werkt zoals verwacht
3. Pas eventueel de kleuren/styling aan naar je wensen









