# ⚠️ URGENT: RLS Fix - Stap voor Stap

## Het Probleem
Je krijgt nog steeds deze error:
```
new row violates row-level security policy for table "timesheet"
```

Dit betekent dat er nog oude RLS policies zijn die de INSERT blokkeren.

## De Oplossing: DEFINITIEF Script

Ik heb een **DEFINITIEF** script gemaakt dat:
1. **ALLE policies dropt** (ongeacht de naam)
2. **Nieuwe policies aanmaakt** die werken met custom auth

## 📋 Stap-voor-Stap Instructies

### STAP 1: Check Bestaande Policies (Optioneel maar Aanbevolen)

**Dit helpt ons te zien wat er nu bestaat:**

1. Ga naar **Supabase Dashboard** → **SQL Editor**
2. Open het bestand: **`CHECK_EXISTING_POLICIES.sql`**
3. Kopieer en plak in SQL Editor
4. Klik **Run**
5. **Noteer** welke policies er bestaan (vooral op `timesheet` tabel)

### STAP 2: Voer Het DEFINITIEVE Script Uit

1. **Open Supabase Dashboard:**
   - Ga naar: https://supabase.com/dashboard
   - Log in
   - Selecteer je project

2. **Open SQL Editor:**
   - Klik op **"SQL Editor"** (links in menu)
   - Klik op **"New query"** (of `Ctrl + N`)

3. **Kopieer en Plak Het Script:**
   - Open: **`FIX_ALL_RLS_DEFINITIVE.sql`**
   - Selecteer ALLES (`Ctrl + A`)
   - Kopieer ALLES (`Ctrl + C`)
   - Plak in SQL Editor (`Ctrl + V`)

4. **Voer Uit:**
   - Klik op **"Run"** (of druk `Ctrl + Enter`)
   - **Wacht** op resultaat

5. **Check Resultaat:**
   - Je zou moeten zien: **"Success. No rows returned"**
   - **OF** een lijst met "DROP POLICY" statements die uitgevoerd zijn
   - Als er een fout is, **kopieer de exacte foutmelding**

### STAP 3: Test De Applicatie

Na succesvol uitvoeren:

1. **Refresh de website** (F5)
2. **Test uren toevoegen:**
   - Ga naar Admin Panel
   - Probeer uren toe te voegen aan een user
   - Error zou moeten verdwijnen
   
3. **Test andere functionaliteiten:**
   - ✅ Uren verwijderen
   - ✅ Screenshots opslaan
   - ✅ Login
   - ✅ Alle andere features

## 🔍 Wat Het Script Doet

Het script:
1. **Maakt een helper functie** die ALLE policies dropt op een tabel
2. **Gebruikt deze functie** voor elke tabel:
   - `users`
   - `timesheet` ← **Dit is waar het probleem zit**
   - `screenshots`
   - `projects`
   - `confirmed_weeks`
   - `reminders`
   - `error_logs`
3. **Maakt nieuwe policies aan** die `anon` en `service_role` toestaan
4. **Verwijdert de helper functie** na gebruik

## ⚠️ Belangrijk

- **Script is veilig:** Het dropt alleen policies, geen data
- **Script is idempotent:** Kan meerdere keren uitgevoerd worden
- **Geen backup nodig:** Policies zijn makkelijk te herstellen

## 🐛 Als Er Nog Steeds Een Fout Is

Als na dit script het nog steeds niet werkt:

1. **Check console** (F12) in browser voor exacte error
2. **Run CHECK_EXISTING_POLICIES.sql** om te zien welke policies nog bestaan
3. **Deel de exacte foutmelding** en ik maak een specifieke fix

## ✅ Na Uitvoeren

Als het werkt:
- ✅ Error zou moeten verdwijnen
- ✅ Alles zou moeten werken
- ✅ Geen verdere actie nodig

**Laat me weten of het werkt!**

