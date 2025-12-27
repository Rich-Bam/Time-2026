# 🔥 URGENT: Cache Fix voor Live Website

## Probleem
Gebruikers kunnen niet inloggen op de live website omdat ze oude JavaScript files hebben gecached door de service worker.

## Oplossing
Ik heb een automatisch cleanup script toegevoegd aan `index.html` dat:
1. **Automatisch oude service workers unregisters**
2. **Alle caches cleared**
3. **Versie check** - Als de versie niet matcht, wordt automatisch cleanup gedaan
4. **Automatisch reload** - Na cleanup wordt de pagina automatisch herladen

## Wat Je Nu Moet Doen

### 1. Deploy de Nieuwe Code (URGENT!)
De nieuwe code moet naar de live website worden gedeployed. De fix werkt alleen als de nieuwe `index.html` met het cleanup script live is.

### 2. Voor Gebruikers Die Nog Niet Kunnen Inloggen
Zodra de nieuwe code live is, hebben gebruikers 2 opties:

**Optie A: Automatisch (Aanbevolen)**
- Gewoon de website openen
- Het script detecteert automatisch de versie mismatch
- Cleanup wordt automatisch uitgevoerd
- Pagina wordt automatisch herladen
- Gebruiker kan nu inloggen

**Optie B: Handmatig Trigger**
Als automatisch niet werkt, gebruikers kunnen naar:
```
https://jouw-website.nl?clearCache=true
```
De `?clearCache=true` parameter forceert de cleanup.

### 3. Testen Na Deployment
1. ✅ Test in incognito (werkt altijd, geen cache)
2. ✅ Test in normale browser - zou automatisch moeten werken
3. ✅ Check browser console (F12) - je zou cleanup logs moeten zien

## Hoe Het Werkt

### Versie Systeem
- Elke deployment krijgt een nieuwe versie nummer (momenteel `2.0.1`)
- Versie wordt opgeslagen in `localStorage`
- Bij elke page load wordt de versie gecheckt
- Als versie niet matcht → automatische cleanup

### Cleanup Process
1. **Detectie**: Script checkt versie bij page load
2. **Service Worker Unregister**: Alle oude service workers worden unregistered
3. **Cache Clear**: Alle browser caches worden geleegd
4. **localStorage Clear**: Behalve language preference (wordt behouden)
5. **Versie Update**: Nieuwe versie wordt opgeslagen
6. **Reload**: Pagina wordt herladen met nieuwe versie

### Toekomstige Updates
Voor elke nieuwe deployment waarbij je wilt dat gebruikers automatisch updaten:
1. Update de `CURRENT_VERSION` in `index.html` (bijv. `2.0.2`, `2.0.3`, etc.)
2. Deploy naar live
3. Gebruikers krijgen automatisch de nieuwe versie

## Technische Details

### Script Locatie
Het cleanup script staat in `index.html` als inline script, vóór React laadt. Dit zorgt ervoor dat:
- Script draait voordat React/Service Worker laadt
- Oude service workers kunnen worden unregistered
- Nieuwe service worker kan daarna worden geregistreerd door VitePWA

### Waarom Inline Script?
- Moet draaien VOORDAT React laadt
- Moet draaien VOORDAT service worker geregistreerd wordt
- Inline script in HTML is de enige manier om dit te garanderen

### Production Only
Het script draait alleen in production (niet op localhost) zodat development niet wordt beïnvloed.

## Troubleshooting

### Als Gebruikers Nog Steeds Problemen Hebben
1. **Check Console**: F12 → Console tab → Zoek naar cleanup logs
2. **Handmatig Clear**: Gebruikers kunnen `?clearCache=true` toevoegen aan URL
3. **Hard Refresh**: `Ctrl+Shift+R` (Windows) of `Cmd+Shift+R` (Mac)
4. **Browser Cache Clear**: DevTools → Application → Clear Storage → Clear site data

### Als Cleanup Script Niet Werkt
1. Check of `index.html` correct is gedeployed
2. Check browser console voor errors
3. Check of versie nummer is geupdate
4. Probeer handmatig: `?clearCache=true` parameter

## Status
- ✅ Cleanup script toegevoegd aan `index.html`
- ✅ Versie systeem geïmplementeerd
- ⏳ Wacht op deployment naar live website
- ⏳ Testen na deployment

