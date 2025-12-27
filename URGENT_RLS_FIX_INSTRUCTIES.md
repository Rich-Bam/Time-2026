# ⚠️ URGENT: RLS Fix Uitvoeren

## Het Probleem

Je ziet deze error:
```
new row violates row-level security policy for table "timesheet"
```

Dit betekent dat de **RLS policies** op de `timesheet` tabel (en andere tabellen) verkeerd zijn ingesteld.

## De Oplossing

Je moet het **`FIX_ALL_RLS_POLICIES_CUSTOM_AUTH.sql`** script uitvoeren in Supabase.

## 📋 Stap-voor-Stap Instructies

### 1. Open Supabase Dashboard
- Ga naar: https://supabase.com/dashboard
- Log in met je account
- Selecteer je project (waarschijnlijk: `bgddtkiekjcdhcmrnxsi`)

### 2. Open SQL Editor
- Klik op **"SQL Editor"** in het menu (links in de sidebar)
- Of ga direct naar: Project → SQL Editor

### 3. Maak Nieuw Query
- Klik op **"New query"** knop (rechts bovenin)
- Of druk `Ctrl + N`

### 4. Kopieer en Plak Script
- Open het bestand: **`FIX_ALL_RLS_POLICIES_CUSTOM_AUTH.sql`**
- Selecteer ALLES (Ctrl+A)
- Kopieer ALLES (Ctrl+C)
- Plak in de SQL Editor in Supabase (Ctrl+V)

### 5. Voer Script Uit
- Klik op de **"Run"** knop (rechts bovenin)
- Of druk op **`Ctrl + Enter`**

### 6. Wacht Op Resultaat
- Je zou moeten zien: **"Success. No rows returned"** of een vergelijkbaar bericht
- Als er een fout is, **kopieer de exacte foutmelding** en deel deze

### 7. Test De Applicatie
Na het uitvoeren:
- ✅ Test **uren toevoegen** (INSERT) → zou moeten werken
- ✅ Test **uren verwijderen** (DELETE) → zou moeten werken
- ✅ Test **uren updaten** (UPDATE) → zou moeten werken
- ✅ Test **screenshots** → zou moeten werken
- ✅ Test **login** → zou moeten werken

## ⚠️ Belangrijk

- **Backup maken** (optioneel maar aanbevolen):
  - In Supabase Dashboard → Database → Backups
  - Maak een backup voordat je het script uitvoert
  
- **Script is veilig:**
  - Het script is **idempotent** (kan meerdere keren uitgevoerd worden)
  - Het dropt oude policies en maakt nieuwe aan
  - Het wijzigt GEEN data, alleen policies

## 🐛 Als Er Een Fout Is

Als je een fout ziet na het uitvoeren:

1. **Kopieer de EXACTE foutmelding**
2. **Noteer op welke regel/tafel de fout optreedt**
3. **Deel dit met de developer**

Veelvoorkomende fouten:
- ❌ "policy already exists" → Script is al uitgevoerd, dat is OK
- ❌ "table does not exist" → Tabel naam klopt niet
- ❌ "syntax error" → Check of je het hele script gekopieerd hebt

## ✅ Na Uitvoeren

Na succesvol uitvoeren:
- Error message zou moeten verdwijnen
- Uren toevoegen/verwijderen zou moeten werken
- Screenshots zouden moeten werken
- Alles zou moeten werken!

## 📝 Wat Het Script Doet

Het script:
1. **Dropt alle oude RLS policies** op deze tabellen:
   - `users`
   - `timesheet`
   - `screenshots`
   - `projects`
   - `confirmed_weeks`
   - `reminders`
   - `error_logs`

2. **Maakt nieuwe policies aan** die `anon` en `service_role` toestaan:
   - SELECT (lezen)
   - INSERT (toevoegen)
   - UPDATE (wijzigen)
   - DELETE (verwijderen)

3. **Waarom?** Omdat de app **custom authentication** gebruikt, is `auth.role()` altijd `'anon'`, niet `'authenticated'`. De oude policies verwachtten `'authenticated'`, dus blokkeerden ze alles.

## 🚀 Klaar?

Na het uitvoeren van dit script zou alles moeten werken!

Laat me weten als het werkt of als er een fout is.

