# ⚠️ BELANGRIJK: RLS Policy voor Users Table

## Het Probleem
De applicatie gebruikt **custom authentication** (niet Supabase Auth). Dit betekent dat `auth.role()` altijd `'anon'` is, niet `'authenticated'`.

Als een RLS policy vereist dat `auth.role() = 'authenticated'`, dan zullen alle login queries falen met "user not found".

## De Oplossing
De `users` tabel MOET een SELECT policy hebben die `'anon'` role toestaat.

### Correcte Policy:
```sql
CREATE POLICY "Allow all SELECT on users"
ON public.users FOR SELECT
USING (true);
```

OF:

```sql
CREATE POLICY "Allow anon and service_role to view users"
ON public.users FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');
```

### INCORRECTE Policy (blokkeert login):
```sql
-- ❌ FOUT - Dit blokkeert login!
CREATE POLICY "Authenticated users can view all users"
ON public.users FOR SELECT
USING (auth.role() = 'authenticated');
```

## Als Je Nieuwe RLS Policies Maakt

### ✅ DOE DIT:
1. Gebruik `USING (true)` voor SELECT op users table
2. OF gebruik `auth.role() = 'anon'` 
3. Test ALTIJD login na het wijzigen van RLS policies

### ❌ NIET DOEN:
1. Vereis NIET `auth.role() = 'authenticated'` voor SELECT op users table
2. Wijzig NIET de SELECT policy zonder te testen

## Verificatie Script

Gebruik dit script om te checken of de RLS policy correct is:

```sql
-- Check welke policies actief zijn op users table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'SELECT';

-- Check of er een policy is die 'anon' toestaat
SELECT 
  policyname,
  qual
FROM pg_policies 
WHERE tablename = 'users' 
  AND cmd = 'SELECT'
  AND (qual LIKE '%anon%' OR qual = 'true');
```

Als deze query GEEN resultaten teruggeeft, dan is de policy waarschijnlijk verkeerd!

## Als Login Niet Werkt

1. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'users';
   ```

2. **Fix met:**
   ```sql
   -- Run FIX_RLS_USERS_SIMPLE.sql
   ```

3. **Test login opnieuw**

## Best Practices

- ✅ Gebruik `USING (true)` voor SELECT op users table (simplest, always works)
- ✅ Test login na elke RLS policy wijziging
- ✅ Documenteer welke policies nodig zijn voor custom auth
- ❌ Verwijder of wijzig SELECT policy op users zonder backup/verificatie
- ❌ Gebruik `auth.role() = 'authenticated'` niet voor SELECT op users table

