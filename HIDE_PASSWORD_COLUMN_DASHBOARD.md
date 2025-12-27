# Wachtwoorden Verbergen in Supabase Dashboard

## Snelste Oplossing (Aanbevolen)

### Stap 1: Verberg de kolom in de dashboard
1. Ga naar je **Supabase Dashboard**
2. Navigeer naar **Table Editor** → **users** tabel
3. **Rechtsklik** op de **password** kolom header
4. Klik op **"Hide Column"** of **"Verberg kolom"**
5. De password kolom verdwijnt nu uit de weergave

**Let op:** De wachtwoorden blijven in de database (nodig voor login), maar zijn niet meer zichtbaar in de UI.

## Alternatief: Gebruik de View

Als je de `users_public` view hebt aangemaakt:

1. Ga naar **Database** → **Views** (in de linker sidebar)
2. Klik op **users_public**
3. Deze view toont alle kolommen BEHALVE password

## Controleren of de View bestaat

Run dit SQL script in de SQL Editor:
```sql
SELECT * FROM users_public LIMIT 1;
```

Als dit werkt, bestaat de view. Als je een error krijgt, moet je eerst het `hide_password_simple.sql` script uitvoeren.

## Belangrijk

- De password kolom blijft in de database (nodig voor login functionaliteit)
- Het verbergen is alleen visueel - de data blijft bestaan
- Voor echte beveiliging zou je wachtwoorden moeten hashen (toekomstige verbetering)

















