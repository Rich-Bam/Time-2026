# iOS App Setup - BAMPRO MARINE Urenregistratie

Deze gids legt uit hoe je deze web app kunt publiceren als iOS app in de Apple App Store.

## Optie 1: Capacitor (Aanbevolen) ✅

Dit is de **beste optie** omdat:
- ✅ Gebruikt je bestaande web code (geen herschrijving nodig)
- ✅ Native iOS features beschikbaar
- ✅ Kan via App Store worden gepubliceerd
- ✅ Werkt ook voor Android (één codebase)

### Vereisten:

1. **Mac computer** (vereist voor iOS development)
2. **Xcode** (gratis, download via App Store)
3. **Apple Developer Account** ($99/jaar)
4. **Node.js** (al geïnstalleerd)

### Stappen:

#### 1. Installeer Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios
```

#### 2. Initialiseer Capacitor

```bash
npx cap init
```

Vul in:
- **App name**: BAMPRO Uren
- **App ID**: nl.bampro.uren (of iets anders unieks)
- **Web dir**: dist

#### 3. Build je Web App

```bash
npm run build
```

Dit maakt een `dist` folder met je gebouwde app.

#### 4. Voeg iOS Platform Toe

```bash
npx cap add ios
```

Dit maakt een `ios` folder met je iOS project.

#### 5. Sync Capacitor

```bash
npx cap sync
```

Dit kopieert je web app naar het iOS project.

#### 6. Open in Xcode

```bash
npx cap open ios
```

Dit opent je project in Xcode.

#### 7. Configureer in Xcode

1. **Selecteer je project** in de linker sidebar
2. **General tab**:
   - **Display Name**: BAMPRO Uren
   - **Bundle Identifier**: nl.bampro.uren (moet uniek zijn)
   - **Version**: 1.0.0
   - **Build**: 1

3. **Signing & Capabilities**:
   - Vink "Automatically manage signing" aan
   - Selecteer je **Team** (je Apple Developer account)
   - Xcode maakt automatisch een provisioning profile aan

4. **App Icons**:
   - Klik op "AppIcon" in Assets
   - Sleep je logo naar de juiste icon sizes:
     - 20x20 (2x, 3x)
     - 29x29 (2x, 3x)
     - 40x40 (2x, 3x)
     - 60x60 (2x, 3x)
     - 76x76 (1x, 2x)
     - 83.5x83.5 (2x)
     - 1024x1024 (App Store)

#### 8. Test op Simulator

1. Selecteer een simulator (bijv. iPhone 14 Pro)
2. Klik op de **Play** knop (▶️) of druk `Cmd + R`
3. De app zou moeten openen in de simulator

#### 9. Test op Echt Device

1. Verbind je iPhone via USB
2. Selecteer je device in Xcode
3. Vertrouw het certificaat op je iPhone (Settings → General → VPN & Device Management)
4. Klik op **Play** om te installeren

#### 10. Maak App Store Connect App

1. Ga naar [App Store Connect](https://appstoreconnect.apple.com)
2. Klik op "My Apps" → "+" → "New App"
3. Vul in:
   - **Platform**: iOS
   - **Name**: BAMPRO Uren
   - **Primary Language**: Dutch
   - **Bundle ID**: nl.bampro.uren
   - **SKU**: bampro-uren-001 (uniek ID)

#### 11. Build voor App Store

1. In Xcode:
   - Selecteer "Any iOS Device" als target
   - Menu: **Product** → **Archive**
   - Wacht tot archive klaar is

2. **Distribute App**:
   - Klik op "Distribute App"
   - Selecteer "App Store Connect"
   - Kies "Upload"
   - Volg de wizard

#### 12. Submit voor Review

1. In App Store Connect:
   - Ga naar je app → "App Store" tab
   - Vul alle informatie in:
     - **Screenshots** (vereist voor verschillende schermformaten)
     - **Description**: Beschrijving van je app
     - **Keywords**: urenregistratie, timesheet, bampro
     - **Support URL**: https://bampro-uren.nl
     - **Privacy Policy URL**: (vereist)
     - **Category**: Business / Productivity
   - Klik op "Submit for Review"

2. Wacht op goedkeuring (meestal 1-3 dagen)

## Optie 2: PWA via Safari (Gratis, maar beperkt)

iOS ondersteunt PWA's, maar je kunt ze **niet direct** in de App Store publiceren.

### Wat je wel kunt doen:

1. Gebruikers kunnen de app installeren via Safari:
   - Ga naar https://bampro-uren.nl
   - Tap op "Share" → "Add to Home Screen"
   - De app verschijnt als icon op het home screen

2. **Beperkingen**:
   - ❌ Niet beschikbaar in App Store
   - ❌ Geen push notifications (beperkt)
   - ❌ Geen native iOS features
   - ✅ Gratis
   - ✅ Werkt offline (via service worker)

## Belangrijke Notities:

### Apple Developer Account
- **Kosten**: $99/jaar (ongeveer €90/jaar)
- **Vereist voor**: App Store publicatie
- **Niet vereist voor**: Testen op je eigen device (gratis account werkt)

### App Icons
- Zorg dat je logo in verschillende sizes beschikbaar is
- Gebruik een tool zoals [App Icon Generator](https://www.appicon.co/) om alle sizes te genereren
- Minimale size: 1024x1024 voor App Store

### Screenshots Vereist
- **iPhone 6.7"** (iPhone 14 Pro Max): 1290 x 2796 pixels
- **iPhone 6.5"** (iPhone 11 Pro Max): 1242 x 2688 pixels
- **iPhone 5.5"** (iPhone 8 Plus): 1242 x 2208 pixels
- Minimaal 1 screenshot per schermformaat

### Privacy Policy
- **Vereist** voor App Store submission
- Moet uitleggen welke data je verzamelt
- Voorbeeld: "We verzamelen alleen urenregistratie data die door gebruikers wordt ingevoerd. Data wordt opgeslagen in Supabase en is alleen toegankelijk voor geautoriseerde gebruikers."

### Updates
- Met Capacitor: Je moet een nieuwe versie uploaden naar App Store
- Updates gaan via App Store (niet automatisch zoals web)
- Verhoog "Build" nummer in Xcode voor elke update

## Kosten Vergelijking:

| Feature | Android (TWA) | iOS (Capacitor) |
|---------|---------------|-----------------|
| Setup | €25 eenmalig | $99/jaar |
| Updates | Automatisch (web) | Via App Store |
| Native Features | Beperkt | Volledig |
| Maintenance | Laag | Medium |

## Snelle Start (Capacitor):

```bash
# 1. Installeer Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios

# 2. Initialiseer
npx cap init

# 3. Build web app
npm run build

# 4. Voeg iOS toe
npx cap add ios
npx cap sync

# 5. Open in Xcode
npx cap open ios
```

## Troubleshooting:

### "No devices found"
- Zorg dat je iPhone is verbonden via USB
- Vertrouw het certificaat op je iPhone
- Check Xcode → Window → Devices and Simulators

### "Signing error"
- Zorg dat je Apple Developer account is ingelogd in Xcode
- Vink "Automatically manage signing" aan
- Check Bundle Identifier is uniek

### "Archive failed"
- Zorg dat je "Any iOS Device" hebt geselecteerd (niet simulator)
- Check of alle dependencies zijn geïnstalleerd
- Clean build folder: Product → Clean Build Folder

## Support:

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Apple Developer Guide](https://developer.apple.com/documentation/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## Volgende Stappen:

1. ⏳ Installeer Capacitor en dependencies
2. ⏳ Build web app en sync naar iOS
3. ⏳ Test op simulator en echt device
4. ⏳ Maak App Store Connect app
5. ⏳ Archive en upload naar App Store
6. ⏳ Submit voor review





