-- ============================================
-- Enable RLS en voeg policies toe voor screenshots tabel
-- ============================================

-- Enable Row Level Security
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- Policy 1: Iedereen kan screenshots toevoegen (admins)
-- Als deze al bestaat, krijg je een error maar dat is oké
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'screenshots' 
    AND policyname = 'Anyone can insert screenshots'
  ) THEN
    CREATE POLICY "Anyone can insert screenshots" ON public.screenshots
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Policy 2: Authenticated users kunnen screenshots bekijken
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'screenshots' 
    AND policyname = 'Authenticated users can view screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can view screenshots" ON public.screenshots
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Policy 3: Authenticated users kunnen screenshots verwijderen
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'screenshots' 
    AND policyname = 'Authenticated users can delete screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can delete screenshots" ON public.screenshots
      FOR DELETE
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================
-- KLAAR!
-- ============================================












