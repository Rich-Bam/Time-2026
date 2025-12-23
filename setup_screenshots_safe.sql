-- ============================================
-- SCREENSHOT SETUP - SAFE VERSION
-- Dit script maakt alleen aan wat nog niet bestaat
-- Veilig om meerdere keren uit te voeren
-- ============================================

-- Stap 1: Maak de screenshots tabel aan (als die nog niet bestaat)
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

-- Stap 2: Enable Row Level Security (als nog niet enabled)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'screenshots'
  ) THEN
    ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Stap 3: Policies aanmaken (alleen als ze nog niet bestaan)
-- Policy 1: Insert
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

-- Policy 2: Select
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

-- Policy 3: Delete
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

-- Stap 4: Indexes aanmaken (als ze nog niet bestaan)
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON public.screenshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);

-- ============================================
-- KLAAR! 
-- Als je geen errors ziet, is alles goed ingesteld.
-- ============================================









