# Diagnose Login Probleem

## Stap 1: Check Browser Console

1. Open de productie website (https://bampro-uren.nl)
2. Druk op **F12** om Developer Tools te openen
3. Ga naar de **Console** tab
4. Probeer in te loggen
5. Noteer alle errors die je ziet

## Stap 2: Check Network Tab

1. In Developer Tools, ga naar de **Network** tab
2. Probeer opnieuw in te loggen
3. Zoek naar requests naar `/rest/v1/users`
4. Klik op de request en check:
   - **Status code** (is het 406, 403, 404, of iets anders?)
   - **Response** tab - wat staat er in het response?

## Stap 3: Check of Deployment Up-to-date is

De fix voor de 406 error is in commit `8eb7580`. Check of deze is gedeployed:

1. Open de productie website
2. Druk op **Ctrl+Shift+I** (of F12)
3. Ga naar **Sources** tab
4. Zoek naar `client.ts` of `index-*.js`
5. Open het bestand en zoek naar `apikey` in de code
6. Als je `'apikey': supabaseKey` ziet, dan is de fix gedeployed
7. Als je dit NIET ziet, dan is de oude code nog actief

## Stap 4: Hard Refresh / Cache Clear

1. Druk op **Ctrl+Shift+R** (hard refresh)
2. Of: **Ctrl+F5**
3. Probeer opnieuw in te loggen

## Stap 5: Test in Incognito/Private Window

1. Open een **incognito/private browsing window**
2. Ga naar https://bampro-uren.nl
3. Probeer in te loggen
4. Als het in incognito WEL werkt, dan is het een cache probleem

## Mogelijke Oorzaken

### 1. Deployment niet bijgewerkt
- **Oplossing:** Wacht even (1-2 minuten) of trigger een nieuwe deployment

### 2. Cache probleem
- **Oplossing:** Hard refresh (Ctrl+Shift+R) of clear browser cache

### 3. RLS Policies zijn veranderd
- **Oplossing:** Check Supabase Dashboard → Authentication → Policies

### 4. 406 Error (Not Acceptable)
- **Oplossing:** De fix moet worden gedeployed (check Stap 3)

### 5. 403 Error (Forbidden)
- **Oplossing:** RLS policies blokkeren de query - check policies

## Wat te doen na diagnose

Stuur de volgende informatie:
- Status code van de failed request (406, 403, 404, etc.)
- Error message uit console
- Response body van de failed request
- Of de fix code zichtbaar is in de deployed code (Stap 3)


