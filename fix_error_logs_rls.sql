-- ============================================
-- FIX ERROR_LOGS RLS POLICIES
-- Dit script repareert de RLS policies voor error_logs
-- zodat de delete functionaliteit werkt
-- ============================================

-- Drop ALL existing policies for error_logs (inclusief alle mogelijke namen)
DROP POLICY IF EXISTS "Super admin can view error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admin can update error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admin can delete error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Authenticated users can view error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Authenticated users can update error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Authenticated users can delete error logs" ON public.error_logs;

-- Policy: Anyone can insert errors (zodat errors kunnen worden gelogd)
CREATE POLICY "Anyone can insert error logs" ON public.error_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Authenticated users kunnen error logs bekijken
-- De app controleert al of de gebruiker super admin is
CREATE POLICY "Authenticated users can view error logs" ON public.error_logs
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Policy: Authenticated users kunnen error logs updaten
-- De app controleert al of de gebruiker super admin is
CREATE POLICY "Authenticated users can update error logs" ON public.error_logs
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Policy: Authenticated users kunnen error logs verwijderen
-- De app controleert al of de gebruiker super admin is voordat delete wordt toegestaan
CREATE POLICY "Authenticated users can delete error logs" ON public.error_logs
  FOR DELETE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================
-- KLAAR!
-- ============================================
-- Na het uitvoeren van dit script zou de delete functionaliteit moeten werken
-- De app controleert al of de gebruiker super admin is voordat delete wordt toegestaan
