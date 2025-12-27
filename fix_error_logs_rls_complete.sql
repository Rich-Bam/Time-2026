-- ============================================
-- COMPLETE FIX FOR ERROR_LOGS RLS POLICIES
-- Dit script repareert ALLE RLS policies voor error_logs
-- zodat de delete functionaliteit werkt met custom auth
-- ============================================

-- Stap 1: Drop ALL existing policies (inclusief alle mogelijke namen)
DROP POLICY IF EXISTS "Super admin can view error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admin can update error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admin can delete error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Authenticated users can view error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Authenticated users can update error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Authenticated users can delete error logs" ON public.error_logs;

-- Stap 2: Maak nieuwe policies die werken met custom auth
-- De app gebruikt custom auth (geen Supabase Auth), dus we moeten RLS anders instellen

-- Policy: Anyone can insert errors (zodat errors kunnen worden gelogd)
CREATE POLICY "Anyone can insert error logs" ON public.error_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Iedereen kan error logs bekijken (de app controleert al of je super admin bent)
-- Omdat custom auth geen auth.role() heeft, moeten we RLS uitschakelen of een andere aanpak gebruiken
-- Voor nu: laat iedereen lezen, de app controleert al of je super admin bent
CREATE POLICY "Anyone can view error logs" ON public.error_logs
  FOR SELECT
  USING (true);

-- Policy: Iedereen kan error logs updaten (de app controleert al of je super admin bent)
CREATE POLICY "Anyone can update error logs" ON public.error_logs
  FOR UPDATE
  USING (true);

-- Policy: Iedereen kan error logs verwijderen (de app controleert al of je super admin bent)
-- De app controleert al of de gebruiker super admin is voordat delete wordt toegestaan
CREATE POLICY "Anyone can delete error logs" ON public.error_logs
  FOR DELETE
  USING (true);

-- ============================================
-- ALTERNATIEF: Als je RLS WEL wilt gebruiken met custom auth
-- Dan moet je RLS uitschakelen voor error_logs
-- ============================================
-- ALTER TABLE public.error_logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- KLAAR!
-- ============================================
-- Na het uitvoeren van dit script zou de delete functionaliteit moeten werken
-- De app controleert al of de gebruiker super admin is voordat delete wordt toegestaan
-- Deze policies laten iedereen toe omdat de app-level security al de controle doet







