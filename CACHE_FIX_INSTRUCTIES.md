# Cache Probleem Fix - Service Worker Updates

## Probleem
Als de website werkt in incognito maar niet in normale browser, is dit een **service worker cache probleem**. De browser heeft oude JavaScript files gecached.

## Oplossing
De PWA configuratie is aangepast om:
1. **Automatische updates** - Service worker updates worden meteen actief (`skipWaiting: true`, `clientsClaim: true`)
2. **Cleanup oude caches** - Oude caches worden automatisch opgeruimd
3. **NetworkFirst voor HTML** - HTML wordt altijd van de server gehaald (5 min cache), zodat het altijd verwijst naar de nieuwste JS/CSS files
4. **Vite cache busting** - Vite voegt automatisch hashes toe aan filenames (bijv. `index-abc123.js`), dus nieuwe versies worden automatisch gedetecteerd

## Wat Je Moet Doen

### Voor Gebruikers (Tijdelijke Fix)
Als gebruikers nog oude cache hebben, kunnen ze een van deze opties proberen:

**Optie 1: Hard Refresh**
- **Windows/Linux:** `Ctrl + Shift + R` of `Ctrl + F5`
- **Mac:** `Cmd + Shift + R`

**Optie 2: Cache Clearen (Meest Betrouwbaar)**
1. Open Developer Tools (F12)
2. Ga naar **Application** tab (Chrome) of **Storage** tab (Firefox)
3. Klik op **Clear storage** of **Clear site data**
4. Vink alles aan (cookies, cache, service workers, etc.)
5. Klik **Clear site data**
6. Refresh de pagina

**Optie 3: Service Worker Unregisteren**
1. Open Developer Tools (F12)
2. Ga naar **Application** tab → **Service Workers**
3. Klik op **Unregister** naast de service worker
4. Refresh de pagina

### Voor Jij (Na Deployment)
Na de nieuwe deployment:
1. **Wacht 5-10 minuten** - Laat de nieuwe versie deployen
2. **Test in incognito** - Als het daar werkt, is de nieuwe versie live
3. **Hard refresh** - Gebruik `Ctrl+Shift+R` om te testen
4. **Als het nog steeds niet werkt** - Clear cache (zie Optie 2 hierboven)

## Technische Details

### Wat is Veranderd in `vite.config.ts`:

```typescript
workbox: {
  // Cleanup oude caches
  cleanupOutdatedCaches: true,
  
  // Skip waiting - updates worden meteen actief
  skipWaiting: true,
  clientsClaim: true,
  
  // NetworkFirst voor HTML - altijd laatste versie
  runtimeCaching: [
    {
      urlPattern: /\.(?:html)$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'html-cache',
        expiration: {
          maxAgeSeconds: 60 * 5 // Alleen 5 minuten cache
        }
      }
    }
  ]
}
```

### Hoe Werkt Het:
1. **Nieuwe deployment** - Vite bouwt nieuwe JS files met nieuwe hashes (bijv. `index-xyz789.js`)
2. **Service worker update** - Nieuwe service worker wordt gedownload
3. **skipWaiting** - Nieuwe service worker wordt meteen actief (geen wachten)
4. **HTML check** - Bij elke pagina load wordt HTML van server gehaald (5 min cache)
5. **Nieuwe JS files** - HTML verwijst naar nieuwe JS files met nieuwe hashes
6. **Oude cache cleanup** - Oude caches worden automatisch verwijderd

## Toekomstige Updates
Na deze fix zouden toekomstige updates automatisch moeten werken zonder cache problemen. Gebruikers hoeven alleen maar de pagina te refreshen.

## Testen
Na deployment:
1. ✅ Test in incognito (werkt altijd, geen cache)
2. ✅ Test met hard refresh (`Ctrl+Shift+R`)
3. ✅ Test normale browser (zou nu moeten werken)
4. ✅ Check console (F12) voor service worker updates

## Als Het Nog Steeds Niet Werkt
1. **Clear alle cache** (Optie 2 hierboven)
2. **Check console** (F12) voor errors
3. **Check Network tab** - Kijk welke JS files worden geladen
4. **Check Application → Service Workers** - Zie welke service worker actief is


