# Cache Troubleshooting Guide

## Probleem: "User not found" na deploy

Als je na een deploy "User not found" krijgt terwijl het op andere devices wel werkt, is dit meestal een caching probleem.

## Oplossingen (in volgorde van proberen):

### 1. Hard Refresh (Snelste oplossing)
- **Windows/Linux:** `Ctrl + Shift + R` of `Ctrl + F5`
- **Mac:** `Cmd + Shift + R`
- Dit forceert de browser om alle bestanden opnieuw te laden

### 2. Clear Browser Cache
1. Open Developer Tools (F12)
2. Rechts-klik op de refresh knop
3. Selecteer "Empty Cache and Hard Reload"

Of via browser instellingen:
- **Chrome/Edge:** Settings → Privacy → Clear browsing data → Cached images and files
- **Firefox:** Settings → Privacy → Clear Data → Cached Web Content

### 3. Clear Service Worker Cache
1. Open Developer Tools (F12)
2. Ga naar **Application** tab (of **Storage** in Firefox)
3. Klik op **Service Workers** in de linker sidebar
4. Klik op **Unregister** bij de service worker
5. Ga naar **Cache Storage** in de linker sidebar
6. Rechts-klik op elke cache en selecteer **Delete**
7. Refresh de pagina (F5)

### 4. Clear All Site Data
1. Open Developer Tools (F12)
2. Ga naar **Application** tab
3. Klik op **Clear storage** in de linker sidebar
4. Vink alles aan
5. Klik op **Clear site data**
6. Refresh de pagina

### 5. Incognito/Private Mode
- Open de website in incognito/private mode
- Dit gebruikt geen cache en zou moeten werken

### 6. Andere Browser
- Probeer een andere browser (Chrome, Firefox, Edge)
- Als het daar wel werkt, is het een cache probleem in de eerste browser

## Voorkomen in de Toekomst

### Voor Developers:
1. **Service Worker Configuratie:**
   - Login queries worden nu niet meer gecached (NetworkOnly)
   - Andere Supabase queries worden nog wel gecached voor performance

2. **Cache Headers:**
   - Supabase client heeft nu cache-control headers
   - Login queries hebben cache-busting

3. **Auto-Update:**
   - Service worker heeft `skipWaiting` en `clientsClaim` enabled
   - Updates worden automatisch geactiveerd

### Voor Gebruikers:
- Als je problemen hebt na een update, probeer eerst een hard refresh (Ctrl+Shift+R)
- Als dat niet werkt, clear de service worker cache (zie stap 3 hierboven)

## Technische Details

### Service Worker Caching:
- **HTML files:** Gecached voor 5 minuten (NetworkFirst)
- **Login queries:** Niet gecached (NetworkOnly)
- **Andere Supabase queries:** Gecached voor 24 uur (NetworkFirst)
- **Static assets:** Gecached tot update

### Waarom gebeurt dit?
- Service workers cachen API calls voor offline support
- Oude versies van de code kunnen gecached blijven
- Browser cache kan oude JavaScript files bevatten
- Dit is normaal gedrag voor PWAs, maar kan problemen veroorzaken na updates

## Als Niets Werkt:

1. **Check Console Errors:**
   - Open Developer Tools (F12)
   - Ga naar Console tab
   - Kijk naar error messages
   - Deel deze met de developer

2. **Check Network Tab:**
   - Open Developer Tools (F12)
   - Ga naar Network tab
   - Probeer in te loggen
   - Kijk naar de requests naar Supabase
   - Check of er 406 of andere errors zijn

3. **Contact Developer:**
   - Beschrijf het probleem
   - Welke browser gebruik je?
   - Welke stappen heb je al geprobeerd?
   - Screenshots van console errors helpen

