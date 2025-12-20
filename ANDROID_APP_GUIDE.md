# Android App Maken van de Website

## Overzicht

Je website is gebouwd met **React + Vite + TypeScript**. Er zijn verschillende manieren om hier een Android app van te maken. Hier zijn de beste opties:

---

## 🎯 Optie 1: Capacitor (Aanbevolen - Meest Eenvoudig)

**Capacitor** is de beste keuze omdat:
- ✅ Gebruikt je bestaande React code (geen herschrijven nodig!)
- ✅ Werkt met Vite (je huidige build tool)
- ✅ Ondersteunt zowel Android als iOS
- ✅ Supabase werkt gewoon door
- ✅ Relatief eenvoudig te implementeren

### Stap 1: Installeer Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
npx cap init
```

Tijdens `npx cap init`:
- **App name:** BAMPRO Time Tracker (of wat je wilt)
- **App ID:** nl.bampro.timetracker (of com.jouwbedrijf.app)
- **Web dir:** dist (dit is waar Vite de build output plaatst)

### Stap 2: Build de Website

```bash
npm run build
```

Dit maakt een `dist` folder met de gebouwde website.

### Stap 3: Voeg Android Platform Toe

```bash
npx cap add android
npx cap sync
```

Dit maakt een `android` folder met het Android project.

### Stap 4: Open in Android Studio

```bash
npx cap open android
```

Dit opent Android Studio waar je:
1. Het project kunt testen in de emulator
2. Een APK kunt bouwen voor installatie
3. Een AAB kunt bouwen voor Google Play Store

### Stap 5: Configureer Android App

**In `android/app/build.gradle`:**
- Pas `applicationId` aan naar je app ID
- Pas `versionCode` en `versionName` aan
- Configureer signing keys voor release builds

**In `android/app/src/main/AndroidManifest.xml`:**
- Pas app naam aan
- Voeg internet permissions toe (voor Supabase)
- Configureer deep links indien nodig

### Stap 6: Test & Build

**Test in Emulator:**
- Open Android Studio
- Kies een device emulator
- Klik "Run"

**Build APK (voor directe installatie):**
```bash
cd android
./gradlew assembleRelease
```
APK staat in: `android/app/build/outputs/apk/release/`

**Build AAB (voor Google Play Store):**
```bash
cd android
./gradlew bundleRelease
```
AAB staat in: `android/app/build/outputs/bundle/release/`

### Stap 7: Updates Na Wijzigingen

Wanneer je de website code aanpast:
```bash
npm run build          # Build de website
npx cap sync           # Sync naar Android project
npx cap open android   # Open in Android Studio
```

---

## 📱 Optie 2: Progressive Web App (PWA) - Eenvoudigst

**PWA** betekent dat je website al als app kan worden geïnstalleerd op Android:
- ✅ Geen extra code nodig
- ✅ Werkt direct op Android
- ✅ Kan worden geïnstalleerd via browser
- ❌ Minder "native" feel
- ❌ Beperkte toegang tot device features

### Stap 1: Check of PWA Al Werkt

Je hebt al `vite-plugin-pwa` in je dependencies! Check of er al een `manifest.json` of service worker is.

### Stap 2: Configureer PWA (Als nog niet gedaan)

**In `vite.config.ts`:**
```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BAMPRO Time Tracker',
        short_name: 'BAMPRO',
        description: 'Time tracking app',
        theme_color: '#ea580c', // Orange color
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
}
```

### Stap 3: Maak App Icons

Maak iconen:
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

### Stap 4: Deploy & Test

1. Deploy de website
2. Open op Android telefoon in Chrome
3. Menu → "Add to Home Screen"
4. App wordt geïnstalleerd!

**Voordelen:**
- Geen Google Play Store nodig
- Direct beschikbaar
- Updates automatisch

---

## 🔄 Optie 3: React Native (Meer Werk)

**React Native** betekent de app opnieuw bouwen:
- ✅ Volledig native performance
- ✅ Toegang tot alle device features
- ❌ Moet code herschrijven
- ❌ Meer werk

**Niet aanbevolen** tenzij je specifieke native features nodig hebt.

---

## 🎯 Aanbeveling

**Voor jouw situatie: Capacitor (Optie 1)**

Waarom:
1. Je bestaande code werkt gewoon door
2. Supabase integratie blijft werken
3. Je kunt native features toevoegen later
4. Relatief eenvoudig te implementeren
5. Kan naar Google Play Store

---

## 📋 Stappenplan: Capacitor Implementatie

### Fase 1: Setup (1-2 uur)

1. ✅ Installeer Capacitor
2. ✅ Build de website
3. ✅ Voeg Android platform toe
4. ✅ Test in emulator

### Fase 2: Configuratie (2-3 uur)

1. ✅ Configureer app naam, icon, splash screen
2. ✅ Test Supabase connectie
3. ✅ Test alle features (login, time tracking, etc.)
4. ✅ Fix eventuele issues

### Fase 3: Polish (2-4 uur)

1. ✅ Voeg app icon toe
2. ✅ Configureer splash screen
3. ✅ Test op echte Android device
4. ✅ Fix mobile-specifieke bugs

### Fase 4: Release (1-2 uur)

1. ✅ Configureer signing keys
2. ✅ Build release APK/AAB
3. ✅ Test release build
4. ✅ Upload naar Google Play Store (optioneel)

**Totaal: ~6-11 uur werk**

---

## 🔧 Belangrijke Aanpassingen voor Android

### 1. Supabase URL's

Zorg dat Supabase URL's werken op Android:
- Check of CORS correct is geconfigureerd
- Test of API calls werken

### 2. Deep Links

Voor invite emails en password resets:
- Configureer deep links in AndroidManifest.xml
- Update Supabase redirect URLs

### 3. Permissions

Voeg toe aan `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 4. Back Button Handling

Android heeft een back button. Zorg dat deze werkt:
- Capacitor heeft hier standaard support voor
- Test navigatie flows

---

## 📦 Google Play Store Publicatie

### Vereisten:

1. **Google Play Developer Account** ($25 eenmalig)
2. **App Signing Key** (genereer met keytool)
3. **App Icons & Screenshots**
4. **Privacy Policy URL**
5. **App Description**

### Stappen:

1. Maak Google Play Developer account
2. Maak nieuwe app in Play Console
3. Upload AAB bestand
4. Vul app details in
5. Submit voor review

---

## 🆘 Troubleshooting

### Supabase werkt niet in app
- Check CORS settings in Supabase
- Check of internet permission is toegevoegd
- Test met browser DevTools in Android WebView

### App crasht bij openen
- Check Android logs: `adb logcat`
- Check of alle dependencies correct zijn
- Test in emulator eerst

### Build errors
- Check Android Studio voor specifieke errors
- Zorg dat Android SDK correct is geïnstalleerd
- Check Gradle versie

---

## 📚 Handige Links

- **Capacitor Docs:** https://capacitorjs.com/docs
- **Android Studio:** https://developer.android.com/studio
- **Google Play Console:** https://play.google.com/console

---

## 💡 Tips

1. **Test eerst in emulator** voordat je op echt device test
2. **Gebruik Chrome DevTools** voor debugging (via `chrome://inspect`)
3. **Start met development build** voordat je release build maakt
4. **Test alle features** - vooral login en Supabase calls
5. **Overweeg beta testing** via Google Play Internal Testing

---

## ❓ Vragen?

Als je hulp nodig hebt bij een specifieke stap, laat het weten!




