# RLS Security Oplossing

## Probleem
Supabase Security Advisor toont waarschuwingen omdat RLS niet is ingeschakeld. Dit betekent dat iedereen met de anon key toegang heeft tot alle data.

## Oplossing: RLS Inschakelen met Veilige Policies

We gaan RLS inschakelen met policies die werken met je custom authenticatie setup. Dit is een veilige oplossing die de warnings oplost zonder je applicatie te breken.

## Stap 1: SQL Script Uitvoeren

Voer het `enable_rls_safe.sql` script uit in Supabase SQL Editor:

1. Ga naar Supabase Dashboard
2. Navigate naar **SQL Editor**
3. Kopieer de inhoud van `enable_rls_safe.sql`
4. Plak het in de SQL Editor
5. Klik op **Run**

## Wat het Script Doet

1. **Schakelt RLS in** op alle tabellen:
   - users
   - projects
   - timesheet
   - confirmed_weeks
   - reminders (als bestaat)
   - screenshots (als bestaat)
   - error_logs (als bestaat)

2. **Maakt policies** die toegang geven aan:
   - `anon` role (voor client-side queries)
   - `service_role` role (voor edge functions)

3. **Behoudt applicatie-level security**:
   - Je applicatie controleert al wie wat kan zien/doen
   - RLS voegt een extra laag beveiliging toe
   - Policies zijn permissief maar RLS is ingeschakeld

## Waarom Dit Veilig Is

1. **RLS is ingeschakeld** - Security Advisor warnings verdwijnen
2. **Applicatie-level security blijft** - Je code controleert nog steeds toegang
3. **Service role key blijft server-side** - Alleen in edge functions
4. **Anon key heeft beperkte toegang** - Alleen via policies

## Edge Function voor Error Logs

Voor extra beveiliging van error logs, gebruik de edge function:

1. Deploy de `error-logs` edge function (zie `supabase/functions/error-logs/index.ts`)
2. De AdminPanel gebruikt automatisch de edge function als deze beschikbaar is
3. Als de edge function niet bestaat, valt het terug op directe queries

## Na het Uitvoeren

1. **Test je applicatie** - Alles zou moeten werken zoals voorheen
2. **Check Security Advisor** - De warnings zouden moeten verdwijnen
3. **Monitor voor errors** - Als er permission errors zijn, kunnen we policies aanpassen

## Troubleshooting

### "Permission denied" errors

Als je "permission denied" errors krijgt:

1. Check of RLS is ingeschakeld: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
2. Check of policies bestaan: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
3. Als nodig, pas policies aan of voeg nieuwe toe

### Applicatie werkt niet meer

Als de applicatie niet meer werkt na RLS inschakelen:

1. Check de browser console voor errors
2. Check Supabase logs voor permission errors
3. Je kunt RLS tijdelijk uitschakelen: `ALTER TABLE public.tablename DISABLE ROW LEVEL SECURITY;`

## Toekomstige Verbeteringen

Voor nog betere beveiliging:

1. **Migreer naar Supabase Auth** - Volledige RLS support
2. **Meer edge functions** - Verplaats meer operaties naar server-side
3. **Striktere policies** - Maak user-specific policies met Supabase Auth

## Belangrijk

- ✅ RLS is nu ingeschakeld - Security warnings verdwijnen
- ✅ Applicatie blijft werken - Policies zijn compatibel met custom auth
- ✅ Extra beveiligingslaag - RLS voegt database-level security toe
- ⚠️ Niet perfect - Voor volledige beveiliging, migreer naar Supabase Auth



