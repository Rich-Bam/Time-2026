# Lokale Development Workflow

## Probleem
Je wilt wijzigingen maken en testen op localhost voordat ze naar de live website gaan.

## Oplossing: Lokaal Werken

### Stap 1: Start de Development Server

Open een terminal in de project folder en run:

```bash
cd time-track-teamwork-excel-main
npm run dev
```

Dit start een lokale server op `http://localhost:8080` (of een andere poort als 8080 bezet is).

**Belangrijk:** Deze server draait ALLEEN lokaal op jouw computer. Niemand anders kan deze zien, en het heeft GEEN invloed op de live website.

### Stap 2: Maak je Wijzigingen

- Bewerk bestanden in je IDE (bijv. `src/pages/Index.tsx`)
- De development server herlaadt automatisch (hot reload)
- Je ziet de wijzigingen direct in je browser op `http://localhost:8080`

### Stap 3: Test Uitgebreid

- Test alle functionaliteit
- Check of alles werkt zoals verwacht
- Maak zoveel wijzigingen als je wilt - niets gaat naar GitHub of de live site

### Stap 4: Wanneer je Klaar Bent - Push naar GitHub

**Alleen wanneer je zeker weet dat alles werkt:**

```bash
# Check welke bestanden je hebt gewijzigd
git status

# Voeg bestanden toe die je wilt committen
git add <bestandsnaam>
# Of voeg alles toe:
git add .

# Commit je wijzigingen
git commit -m "Beschrijving van je wijzigingen"

# Push naar GitHub (dit update de live site als je CI/CD hebt)
git push origin main
```

## Belangrijke Tips

### ✅ WEL doen:
- Gebruik `npm run dev` voor lokale ontwikkeling
- Test alles eerst lokaal
- Commit en push alleen wanneer je klaar bent

### ❌ NIET doen:
- Wijzigingen maken via Lovable (die worden automatisch gecommit)
- Direct pushen zonder te testen
- Werken op de `main` branch zonder te testen

## Development Branch (Aanbevolen)

Voor extra veiligheid, werk op een aparte branch:

```bash
# Maak een nieuwe development branch
git checkout -b development

# Werk op deze branch
# ... maak je wijzigingen ...

# Test alles lokaal met npm run dev

# Wanneer klaar, merge naar main:
git checkout main
git merge development
git push origin main
```

## Troubleshooting

### "Port 8080 is already in use"
- De server gebruikt automatisch een andere poort
- Check de terminal output voor de juiste URL (bijv. `http://localhost:8081`)

### Wijzigingen worden niet getoond
- Refresh je browser (Ctrl+F5 voor hard refresh)
- Check de terminal voor errors
- Stop de server (Ctrl+C) en start opnieuw met `npm run dev`

### Ik wil wijzigingen ongedaan maken
```bash
# Verwijder alle lokale wijzigingen (LET OP: dit verwijdert alles!)
git restore .

# Of voor een specifiek bestand:
git restore <bestandsnaam>
```

## Samenvatting

1. **Lokaal ontwikkelen:** `npm run dev` → test op localhost
2. **Wijzigingen maken:** Bewerk bestanden, zie resultaat direct
3. **Testen:** Test alles uitgebreid lokaal
4. **Pushen:** Alleen wanneer je zeker weet dat alles werkt

**Onthoud:** `npm run dev` draait ALLEEN lokaal. Niets gaat naar de live site totdat je zelf `git push` doet!

