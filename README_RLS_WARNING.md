# ⚠️ WAARSCHUWING: RLS Scripts

## Belangrijk voor Custom Authentication

Deze applicatie gebruikt **custom authentication** (niet Supabase Auth). Dit betekent dat `auth.role()` altijd `'anon'` is.

## Scripts die NIET gebruikt moeten worden voor users table:

### ❌ `enable_rls_all_tables.sql`
- **Probleem:** Maakt policy met `auth.role() = 'authenticated'`
- **Gevolg:** Blokkeert alle login queries
- **Gebruik dit NIET** voor de users table!

## Scripts die WEL gebruikt moeten worden:

### ✅ `FIX_RLS_USERS_SIMPLE.sql`
- **Correct:** Maakt policy met `USING (true)`
- **Gevolg:** Werkt altijd, staat alle SELECT queries toe
- **Gebruik dit** voor de users table!

### ✅ `hide_password_column.sql`
- **Correct:** Maakt policy met `USING (true)`
- **Gevolg:** Werkt correct
- **Gebruik dit** als je password column wilt verbergen

## Als je een nieuw RLS script maakt:

1. **Voor users table SELECT policy:**
   ```sql
   -- ✅ CORRECT
   CREATE POLICY "Allow all SELECT on users"
   ON public.users FOR SELECT
   USING (true);
   ```

2. **NOOIT doen:**
   ```sql
   -- ❌ FOUT - Blokkeert login!
   CREATE POLICY "Authenticated users can view all users"
   ON public.users FOR SELECT
   USING (auth.role() = 'authenticated');
   ```

## Verificatie

Na het uitvoeren van een RLS script, test altijd:
1. ✅ Login werkt nog?
2. ✅ Run `VERIFY_RLS_POLICIES.sql` om te checken

## Documentatie

Zie `RLS_POLICY_IMPORTANT.md` voor volledige uitleg.

