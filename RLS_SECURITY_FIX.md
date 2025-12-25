# RLS Security Fix - Stap voor Stap

## Probleem
Supabase Security Advisor toont waarschuwingen omdat RLS (Row Level Security) niet is ingeschakeld op je tabellen. Dit betekent dat iedereen met de anon key toegang heeft tot alle data.

## Oplossing
We gaan RLS inschakelen met policies die werken met custom authenticatie. Dit vereist een combinatie van:
1. RLS inschakelen op alle tabellen
2. Policies maken die werken voor authenticated requests
3. Supabase client configureren om authenticated requests te maken

## Stap 1: Supabase Auth Setup (Minimaal)

We moeten Supabase Auth minimaal gebruiken voor RLS, maar kunnen custom auth behouden voor login.

### Optie A: Hybrid Approach (Aanbevolen)
- Gebruik Supabase Auth alleen voor RLS (automatische authenticatie)
- Behoud custom auth voor login/logica
- Maak een "system" user in Supabase Auth die gebruikt wordt voor alle requests

### Optie B: Full Supabase Auth (Meer werk)
- Migreer alle users naar Supabase Auth
- Update alle code om Supabase Auth te gebruiken

## Stap 2: SQL Script Uitvoeren

Voer het `enable_rls_custom_auth.sql` script uit in Supabase SQL Editor.

**LET OP:** Dit script maakt policies die werken voor authenticated requests. Je applicatie moet queries maken als authenticated user.

## Stap 3: Supabase Client Aanpassen

We moeten de Supabase client configureren om authenticated requests te maken. Dit kan door:
1. Een service account te gebruiken voor alle requests
2. Of Supabase Auth te gebruiken voor session management

## Huidige Situatie

Je applicatie gebruikt:
- Custom `users` tabel voor authenticatie
- `anon` key voor alle requests
- Geen Supabase Auth

## Aanbevolen Aanpak

Gezien je setup, is de beste oplossing:

1. **Korte termijn:** RLS inschakelen met permissieve policies voor authenticated role
2. **Lange termijn:** Migreer naar Supabase Auth voor betere beveiliging

Het script `enable_rls_custom_auth.sql` maakt policies die toegang geven aan authenticated users. Dit betekent dat je applicatie queries moet maken als authenticated user.

## Implementatie

### Optie 1: Service Role voor Admin Operaties (Niet aanbevolen voor client-side)
- Gebruik service_role key voor admin operaties
- Gebruik anon key voor user operaties
- **Probleem:** Service role key moet NOOIT in client-side code

### Optie 2: Supabase Auth voor Session (Aanbevolen)
- Maak een Supabase Auth account voor elke user
- Gebruik Supabase Auth session voor RLS
- Behoud custom auth voor login logica

### Optie 3: Edge Functions (Meest Veilig)
- Verplaats alle database operaties naar edge functions
- Edge functions gebruiken service_role key (server-side)
- Client maakt alleen API calls naar edge functions
- **Voordeel:** Service role key blijft server-side
- **Voordeel:** RLS kan worden ingeschakeld zonder applicatie te breken

## Aanbeveling

Voor nu: **Gebruik Optie 3 (Edge Functions)** voor gevoelige operaties en behoud de huidige setup voor de rest.

Voor de toekomst: **Migreer naar Supabase Auth** voor volledige beveiliging.



