-- ============================================
-- SCREENSHOT FUNCTIONALITEIT SETUP
-- Kopieer ALLES vanaf hier tot "EINDE" en plak in Supabase SQL Editor
-- ============================================

-- Stap 1: Maak de screenshots tabel aan
CREATE TABLE IF NOT EXISTS public.screenshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stap 2: Enable Row Level Security
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- Stap 3: Policies voor de tabel
-- Policy 1: Iedereen kan screenshots toevoegen (admins)
CREATE POLICY "Anyone can insert screenshots" ON public.screenshots
  FOR INSERT
  WITH CHECK (true);

-- Policy 2: Authenticated users kunnen screenshots bekijken
CREATE POLICY "Authenticated users can view screenshots" ON public.screenshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy 3: Authenticated users kunnen screenshots verwijderen
CREATE POLICY "Authenticated users can delete screenshots" ON public.screenshots
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Stap 4: Indexes voor snellere queries
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON public.screenshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);

-- ============================================
-- EINDE - Klaar!
-- ============================================
-- 
-- Na het uitvoeren van dit script:
-- 1. Ga naar Storage in Supabase Dashboard
-- 2. Maak een bucket aan genaamd "screenshots" (public)
-- 3. Voeg 3 policies toe aan de bucket (zie SUPABASE_SCREENSHOT_SETUP.md)
-- ============================================


















