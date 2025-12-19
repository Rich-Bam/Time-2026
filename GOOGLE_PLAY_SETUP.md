# Google Play App Setup - BAMPRO MARINE Urenregistratie

Deze gids legt uit hoe je deze web app kunt publiceren als Android app in Google Play Store.

> **Zie ook**: [IOS_APP_SETUP.md](./IOS_APP_SETUP.md) voor iOS App Store publicatie

## Optie 1: Trusted Web Activity (TWA) - Aanbevolen ✅

Dit is de **beste optie** omdat:
- ✅ Gebruikt je bestaande web code (geen herschrijving nodig)
- ✅ Automatische updates via web deployment
- ✅ Eenvoudig te onderhouden
- ✅ Gratis (alleen Google Play Developer fee: €25 eenmalig)

### Stappen:

#### 1. PWA Setup (Al gedaan ✅)
- ✅ `manifest.json` is aangemaakt
- ✅ Service Worker is geconfigureerd via Vite PWA plugin
- ✅ PWA meta tags zijn toegevoegd aan `index.html`

#### 2. Maak een Android App Project

Je hebt twee opties:

**Optie A: Bubblewrap (Eenvoudigst - Aanbevolen)**

1. Installeer Node.js (als je dat nog niet hebt)
2. Installeer Bubblewrap:
   ```bash
   npm install -g @bubblewrap/cli
   ```
3. Maak een nieuw TWA project:
   ```bash
   bubblewrap init --manifest https://bampro-uren.nl/manifest.json
   ```
4. Volg de instructies en vul in:
   - **Package ID**: `nl.bampro.uren` (of iets anders unieks)
   - **App Name**: BAMPRO Uren
   - **Launcher Name**: BAMPRO Uren
   - **Display Mode**: standalone
   - **Theme Color**: #ea580c (orange)
   - **Background Color**: #ffffff (white)

5. Build de app:
   ```bash
   bubblewrap build
   ```

6. Je krijgt een `.aab` bestand in `./app-release/`

**Optie B: Android Studio (Meer controle)**

1. Download [Android Studio](https://developer.android.com/studio)
2. Maak een nieuw "Empty Activity" project
3. Voeg TWA Support Library toe (zie [Google's TWA guide](https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide))
4. Configureer de app om naar `https://bampro-uren.nl` te wijzen

#### 3. Test de App Lokaal

1. Verbind je Android telefoon via USB
2. Zet USB debugging aan (Settings → Developer Options)
3. Run de app:
   ```bash
   bubblewrap install
   ```
   Of in Android Studio: Run → Run 'app'

#### 4. Maak een Google Play Developer Account

1. Ga naar [Google Play Console](https://play.google.com/console)
2. Betaal €25 eenmalige registratiefee
3. Maak een nieuwe app aan

#### 5. Upload naar Google Play

1. In Google Play Console:
   - Ga naar "Production" → "Create new release"
   - Upload het `.aab` bestand (van `bubblewrap build`)
   - Vul app beschrijving, screenshots, etc. in
   - Submit voor review

2. Wacht op goedkeuring (meestal 1-3 dagen)

## Optie 2: Capacitor (Voor Native Features)

Als je later native features nodig hebt (camera, push notifications, etc.):

1. Installeer Capacitor:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npm install @capacitor/android
   npx cap init
   ```

2. Build je web app:
   ```bash
   npm run build
   ```

3. Sync naar Android:
   ```bash
   npx cap sync
   npx cap open android
   ```

4. Open in Android Studio en build

## Belangrijke Notities:

### HTTPS Vereist
- Je website moet HTTPS gebruiken (✅ bampro-uren.nl heeft dit al)
- TWA werkt alleen met HTTPS

### App Updates
- Met TWA: Updates gebeuren automatisch via je website
- Met Capacitor: Je moet een nieuwe versie uploaden naar Play Store

### App Icons
- Zorg dat `/bampro-marine-logo.jpg` de juiste afmetingen heeft:
  - 192x192 pixels (minimum)
  - 512x512 pixels (aanbevolen)
- Je kunt ook PNG gebruiken voor betere kwaliteit

### Testing
- Test altijd op een echte Android device
- Test offline functionaliteit (service worker caching)
- Test verschillende schermformaten

## Kosten:

- **Google Play Developer Account**: €25 eenmalig
- **App Hosting**: Gratis (gebruikt je bestaande Netlify hosting)
- **Updates**: Gratis (automatisch via web)

## Support:

- [Bubblewrap Documentation](https://github.com/GoogleChromeLabs/bubblewrap)
- [TWA Guide](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)

## Volgende Stappen:

1. ✅ PWA setup is klaar
2. ⏳ Test de PWA op mobiel (ga naar bampro-uren.nl en installeer als app)
3. ⏳ Maak Android app met Bubblewrap
4. ⏳ Upload naar Google Play

