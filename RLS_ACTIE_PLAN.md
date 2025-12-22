# RLS Actie Plan - Wat moet je nu doen?

## Huidige Situatie
- ✅ Je applicatie werkt met custom authenticatie (eigen users tabel)
- ✅ RLS is momenteel **disabled** voor alle tabellen
- ⚠️ Dit betekent dat iedereen met de anon key alle data kan zien (beveiligingsrisico)

## Aanbeveling: RLS UITGESCHAKELD HOUDEN (voor nu)

**Waarom?**
- Je applicatie gebruikt geen Supabase Auth
- RLS policies werken alleen met Supabase Auth (`auth.uid()`)
- Als je RLS nu inschakelt, zal je applicatie **niet meer werken**

## Wat moet je WEL doen voor beveiliging?

### 1. Controleer je Supabase Keys
- ✅ Gebruik de **anon key** alleen in client-side code
- ✅ Gebruik de **service_role key** ALLEEN in edge functions (server-side)
- ❌ **NOOIT** de service_role key in client-side code!

### 2. Beveiliging op applicatie-niveau
Je applicatie heeft al goede beveiliging:
- ✅ Login vereist email + password
- ✅ Users moeten approved zijn
- ✅ Admin checks in de code
- ✅ Edge functions voor gevoelige operaties

### 3. Database beveiliging
- ✅ Gebruik edge functions voor alle write operaties waar mogelijk
- ✅ Valideer input in de applicatie
- ✅ Gebruik prepared statements (Supabase doet dit automatisch)

## Scripts die je NIET moet gebruiken (voor nu)

❌ **enable_rls_all_tables.sql** - Werkt niet met custom auth
❌ Alle andere RLS scripts - Werken niet met custom auth

## Wat als je RLS TOCH wilt inschakelen?

Als je RLS wilt inschakelen, moet je eerst migreren naar Supabase Auth. Dit is een grote wijziging:

1. **Migreer gebruikers naar Supabase Auth**
2. **Update alle code** om Supabase Auth te gebruiken
3. **Test alles grondig**
4. **Dan pas** het `enable_rls_all_tables.sql` script gebruiken

## Conclusie: Wat moet je NU doen?

### ✅ DOEN:
1. **Niets** - Houd RLS disabled
2. **Focus op applicatie-level security** (wat je al hebt)
3. **Gebruik edge functions** voor gevoelige operaties
4. **Controleer regelmatig** wie toegang heeft tot je Supabase project

### ❌ NIET DOEN:
1. ❌ RLS inschakelen zonder Supabase Auth migratie
2. ❌ Service role key in client-side code gebruiken
3. ❌ RLS scripts uitvoeren zonder te testen

## Toekomst: Migratie naar Supabase Auth

Als je later RLS wilt inschakelen:
1. Plan een migratie naar Supabase Auth
2. Test in een development omgeving
3. Migreer gebruikers
4. Update code
5. Gebruik dan `enable_rls_all_tables.sql`

## Hulp nodig?

Als je vragen hebt of hulp nodig hebt bij:
- Beveiliging checken
- Edge functions setup
- Toekomstige Supabase Auth migratie

Laat het weten!



