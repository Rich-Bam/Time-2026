# BAMPRO Email Template met Logo - Instructies

## Stap 1: Open Supabase Dashboard

1. Ga naar https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Authentication** → **Email Templates**
4. Selecteer **"Reset Password"** template (of "Change Email Address" als je die wilt aanpassen)

## Stap 2: Kopieer de HTML Template

1. Open het bestand `BAMPRO_PASSWORD_RESET_EMAIL_TEMPLATE.html`
2. Kopieer ALLE inhoud (Ctrl+A, Ctrl+C)
3. Plak het in de **"HTML Body"** editor in Supabase

## Stap 3: Pas Subject Aan (Optioneel)

Je kunt de subject regel aanpassen naar:
- **Nederlands:** "BAMPRO MARINE - Wachtwoord Resetten"
- **Of:** "Reset je BAMPRO MARINE wachtwoord"

## Stap 4: Opslaan

1. Klik op **"Save"** of **"Update Template"**
2. De nieuwe template is nu actief!

## Test de Email

1. Ga naar de login pagina
2. Klik op "Wachtwoord Vergeten?"
3. Voer een email adres in
4. Check de inbox - je zou nu een mooie email moeten zien met het BAMPRO logo!

## Belangrijk

- Het logo gebruikt de URL: `https://bampro-uren.nl/bampro-marine-logo.jpg`
- Zorg dat deze URL publiekelijk toegankelijk is
- De email gebruikt de BAMPRO kleuren (oranje #ea580c)
- De template is responsive en werkt op mobiel en desktop

## Troubleshooting

**Logo wordt niet getoond?**
- Check of `https://bampro-uren.nl/bampro-marine-logo.jpg` bereikbaar is
- Test de URL in je browser
- Sommige email clients blokkeren externe afbeeldingen (gebruiker moet "afbeeldingen tonen" klikken)

**Email ziet er niet goed uit?**
- Sommige email clients (zoals Gmail) hebben beperkte HTML ondersteuning
- De template is geoptimaliseerd voor de meeste email clients
- Test altijd in meerdere email clients


