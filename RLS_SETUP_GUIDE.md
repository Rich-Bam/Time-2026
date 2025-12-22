# Row Level Security (RLS) Setup Guide

## ⚠️ Belangrijke Opmerking

Je applicatie gebruikt momenteel **custom authenticatie** (eigen users tabel met email/password), niet Supabase Auth. RLS policies werken standaard met Supabase Auth (`auth.uid()`), wat betekent dat de standaard RLS policies **niet direct zullen werken** met je huidige setup.

## Opties

### Optie 1: Service Role Key gebruiken (NIET AANBEVOLEN voor productie)

Als je RLS wilt inschakelen maar je custom authenticatie wilt behouden, kun je de **service_role** key gebruiken in je applicatie. Dit bypassed RLS volledig, wat betekent dat RLS geen effect heeft.

**Waarom niet aanbevolen:**
- Service role key geeft volledige database toegang
- Moet alleen server-side gebruikt worden (niet in client-side code)
- Bypassed alle security policies

### Optie 2: Migreren naar Supabase Auth (AANBEVOLEN)

Dit is de beste oplossing voor echte beveiliging:

**Voordelen:**
- ✅ Native RLS support
- ✅ Betere beveiliging
- ✅ Built-in password reset, email verification, etc.
- ✅ OAuth providers (Google, GitHub, etc.)

**Nadelen:**
- ⚠️ Vereist migratie van bestaande gebruikers
- ⚠️ Code aanpassingen nodig

**Stappen:**
1. Migreer gebruikers naar Supabase Auth
2. Update applicatie code om Supabase Auth te gebruiken
3. Gebruik het `enable_rls_all_tables.sql` script

### Optie 3: Custom RLS Policies (Complex)

Je kunt custom policies maken die werken met je custom authenticatie, maar dit is complex en vereist:
- Een manier om de huidige user ID door te geven aan de database
- Custom functions die de user ID kunnen verifiëren
- Mogelijk stored procedures

## Huidige Situatie

Je applicatie gebruikt:
- Custom `users` tabel
- localStorage voor sessie management
- `currentUser.id` (niet `auth.uid()`)

## Wat te doen?

### Als je RLS NU wilt inschakelen:

1. **Test eerst zonder RLS policies:**
   - Zorg dat je applicatie werkt zoals verwacht
   - Maak een backup van je database

2. **Gebruik het script met voorzichtigheid:**
   - Het `enable_rls_all_tables.sql` script is gemaakt voor Supabase Auth
   - Als je het gebruikt met custom auth, zal het waarschijnlijk queries blokkeren

3. **Als queries geblokkeerd worden:**
   - Je kunt RLS tijdelijk uitschakelen per tabel:
     ```sql
     ALTER TABLE public.tablename DISABLE ROW LEVEL SECURITY;
     ```

### Aanbevolen Aanpak

**Voor nu (zonder Supabase Auth):**
- Houd RLS disabled
- Zorg voor goede applicatie-level security
- Gebruik de `anon` key alleen voor publieke queries
- Gebruik edge functions voor gevoelige operaties

**Voor de toekomst:**
- Overweeg migratie naar Supabase Auth
- Dan kun je RLS volledig inschakelen met het script

## Script Gebruik

Het `enable_rls_all_tables.sql` script bevat policies voor:
- ✅ `users` - Gebruikers kunnen eigen data zien, admins kunnen alles
- ✅ `projects` - Gebruikers kunnen eigen projecten beheren
- ✅ `timesheet` - Gebruikers kunnen eigen entries zien/bewerken
- ✅ `confirmed_weeks` - Gebruikers kunnen eigen weeks zien
- ✅ `reminders` - Gebruikers kunnen eigen reminders zien
- ✅ `screenshots` - Authenticated users kunnen screenshots beheren

**Let op:** Deze policies gebruiken `auth.uid()` en werken alleen met Supabase Auth!

## Verificatie

Na het uitvoeren van het script, controleer of RLS enabled is:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Alle tabellen zouden `rowsecurity = true` moeten hebben.

## Troubleshooting

**Als je "permission denied" errors krijgt:**
1. Check of de user ingelogd is via Supabase Auth
2. Check of de policies correct zijn
3. Tijdelijk RLS uitschakelen om te testen:
   ```sql
   ALTER TABLE public.tablename DISABLE ROW LEVEL SECURITY;
   ```

**Als queries niet werken:**
- Je gebruikt waarschijnlijk custom auth
- Overweeg migratie naar Supabase Auth
- Of gebruik service_role key (alleen server-side!)

## Conclusie

Met je huidige custom authenticatie setup, is RLS **niet direct bruikbaar**. Je hebt twee opties:

1. **Korte termijn:** Houd RLS disabled, focus op applicatie-level security
2. **Lange termijn:** Migreer naar Supabase Auth voor echte RLS beveiliging

Het `enable_rls_all_tables.sql` script is klaar voor gebruik zodra je migreert naar Supabase Auth.



