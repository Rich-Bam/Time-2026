# 🔍 Complete Login Problem Diagnosis

## Problemen die ik zie:

### 1. PGRST116 Error (User not found)
- De query retourneert 0 rijen
- Dit kan betekenen:
  - RLS policy blokkeert de query
  - User bestaat niet in database
  - Query syntax is incorrect

### 2. 406 Not Acceptable Error (in Network tab)
- API compatibility probleem
- Headers zijn mogelijk niet correct

## Stappen om te diagnosticeren:

### STAP 1: Check of SQL script is uitgevoerd
1. Ga naar Supabase Dashboard → SQL Editor
2. Voer deze query uit om te zien welke policies actief zijn:
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
```

3. Controleer of je een policy ziet met de naam: `"Allow anon and service_role to view users"`
   - Als deze policy NIET bestaat → Voer `fix_rls_users_table_for_login.sql` uit
   - Als deze policy WEL bestaat → Ga naar STAP 2

### STAP 2: Test de query direct in Supabase
1. Ga naar Supabase Dashboard → Table Editor → users
2. Check of de user `r.blance@bampro.nl` bestaat
3. Als de user NIET bestaat → Dat is het probleem, maak de user aan
4. Als de user WEL bestaat → Ga naar STAP 3

### STAP 3: Test query met anon key
1. Ga naar Supabase Dashboard → API → REST
2. Probeer deze query:
```
GET /rest/v1/users?select=id,email,name&email=eq.r.blance@bampro.nl
Headers:
  apikey: [je anon key]
  Authorization: Bearer [je anon key]
```

3. Als dit werkt → Het probleem is in de app code
4. Als dit NIET werkt → Het probleem is RLS policy

### STAP 4: Check Supabase client configuratie
1. Open browser DevTools → Console
2. Type: `localStorage.getItem('supabase.auth.token')`
3. Check of er een token is

### STAP 5: Volledige RLS reset (laatste redmiddel)
Als niets werkt, voer dit uit om ALLE policies te resetten:
```sql
-- Drop ALL policies on users table
DROP POLICY IF EXISTS "Users can view public user data" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can view users" ON public.users;
DROP POLICY IF EXISTS "Allow access to users table" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow anon and service_role to view users" ON public.users;

-- Create simple policy that allows all SELECT (for testing)
CREATE POLICY "Allow all SELECT on users"
ON public.users FOR SELECT
USING (true);

-- Test login nu
-- Als dit werkt, dan was het een RLS probleem
-- Als dit NIET werkt, dan is het iets anders
```

## Wat moet ik weten:

1. **Is het SQL script (`fix_rls_users_table_for_login.sql`) uitgevoerd?**
   - Ja / Nee

2. **Bestaat de user `r.blance@bampro.nl` in Supabase?**
   - Check in Table Editor → users table
   - Ja / Nee

3. **Wat is de exacte error in de browser console?**
   - Open F12 → Console tab
   - Kopieer alle error messages

4. **Werkt login wel in localhost?**
   - Ja / Nee

5. **Welke status code zie je in Network tab?**
   - 406? 403? 200? Ander?

## Mogelijke oplossingen afhankelijk van diagnose:

### Oplossing A: RLS Policy probleem
→ Voer `fix_rls_users_table_for_login.sql` uit

### Oplossing B: User bestaat niet
→ Maak de user aan in Supabase

### Oplossing C: 406 API compatibility
→ Check Supabase client headers (al gedaan, maar misschien werkt het niet)

### Oplossing D: Cache probleem
→ Clear cache en service worker (al geprobeerd)

### Oplossing E: Supabase project misconfiguratie
→ Check environment variables in Netlify

