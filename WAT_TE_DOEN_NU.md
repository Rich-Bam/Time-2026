# 📋 Wat Te Doen Nu - Stap voor Stap

## ✅ Wat Ik Net Heb Gedaan

1. **Versienummer verhoogd** van `2.0.2` naar `2.0.3` in `index.html`
   - Dit forceert automatisch cache clear voor alle gebruikers na deployment

2. **Cleanup script verbeterd** - werkt nu beter

3. **Verify script gemaakt** - om RLS policies te checken (`VERIFY_RLS_POLICIES_CHECK.sql`)

## 🚀 Stap 1: Deploy Deze Wijziging

### Optie A: Via Git (als je git gebruikt)

```bash
cd "c:\time-track-teamwork-excel-main\time-track-teamwork-excel-main"
git add index.html
git commit -m "Fix: Force cache clear - versie 2.0.3"
git push
```

### Optie B: Via je deployment platform (Netlify/Vercel/etc.)

1. **Push de wijzigingen** naar je repository
2. **Wacht tot deployment klaar is** (krijg je meestal een notificatie)

## ✅ Stap 2: Test Na Deployment

**WACHT** tot deployment compleet is (meestal 2-5 minuten), dan:

1. **Open de live website** in een normale browser (NIET incognito)
2. **Hard refresh**: Druk `Ctrl + Shift + R` (Windows) of `Cmd + Shift + R` (Mac)
3. **Kijk in browser console** (F12):
   - Je zou moeten zien: `🧹 Cleaning up old service workers and cache...`
   - Dan: `✅ Cleanup completed, reloading...`
   - Pagina reload automatisch
4. **Probeer in te loggen** met `r.blance@bampro.nl`
5. **Check of het werkt**

## 🔍 Stap 3: Als Het Nog Steeds Niet Werkt

Als je nog steeds "Gebruiker niet gevonden" krijgt:

### A. Check RLS Policies

1. **Ga naar Supabase Dashboard** → **SQL Editor**
2. **Open**: `VERIFY_RLS_POLICIES_CHECK.sql`
3. **Kopieer alles** (Ctrl+A, Ctrl+C)
4. **Plak in SQL Editor** (Ctrl+V)
5. **Run** (Ctrl+Enter)
6. **Check de resultaten**:
   - Zie je "✅ CORRECT" voor alle policies? → RLS is goed, dan is het cache
   - Zie je "❌ WRONG" voor sommige policies? → RLS is verkeerd

### B. Als RLS Verkeerd Is

Als je "❌ WRONG" policies ziet:

1. **Open**: `FIX_ALL_RLS_DEFINITIVE.sql`
2. **Kopieer alles**
3. **Plak in Supabase SQL Editor**
4. **Run**
5. **Test opnieuw** op live website

### C. Als RLS Goed Is Maar Het Werkt Nog Niet

Dan is het cache. Probeer:

1. **Force cache clear via URL**: Voeg `?clearCache=true` toe aan de URL
   - Bijvoorbeeld: `https://bampro-uren.nl?clearCache=true`
2. **Of**: Clear browser cache handmatig:
   - F12 → Application tab → Clear storage → Clear site data
   - Refresh pagina

## 📊 Samenvatting

**NU DOEN:**
1. ✅ Deploy de wijziging (git push of via deployment platform)
2. ✅ Wacht tot deployment klaar is
3. ✅ Test op live website (hard refresh: Ctrl+Shift+R)
4. ✅ Probeer in te loggen

**ALS HET NIET WERKT:**
- ✅ Run `VERIFY_RLS_POLICIES_CHECK.sql` in Supabase
- ✅ Check of policies "CORRECT" of "WRONG" zijn
- ✅ Als "WRONG": Run `FIX_ALL_RLS_DEFINITIVE.sql`
- ✅ Test opnieuw

**VERWACHT RESULTAAT:**
- Na deployment + hard refresh zou login moeten werken
- Cache wordt automatisch gecleared voor alle gebruikers
- Nieuwe JavaScript code wordt gedownload

## ❓ Vragen?

Als je ergens vastloopt, deel dan:
- Wat je ziet in de browser console (F12)
- De resultaten van het VERIFY script
- Eventuele error messages

**Begin met Stap 1: Deploy de wijziging!**

