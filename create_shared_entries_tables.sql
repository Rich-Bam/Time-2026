-- ============================================
-- CREATE SHARED ENTRIES TABLES
-- ============================================
-- This script creates the tables needed for the entry sharing feature
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create shared_entries table
CREATE TABLE IF NOT EXISTS public.shared_entries (
  id SERIAL PRIMARY KEY,
  sharer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('day', 'week')),
  share_date DATE NOT NULL, -- For 'day': the specific date, for 'week': the Monday of the week
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  message TEXT, -- Optional message from sharer
  FOREIGN KEY (sharer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shared_entries_recipient ON shared_entries(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_shared_entries_sharer ON shared_entries(sharer_id);
CREATE INDEX IF NOT EXISTS idx_shared_entries_date ON shared_entries(share_date, share_type);

-- 2. Create shared_entry_items table
CREATE TABLE IF NOT EXISTS public.shared_entry_items (
  id SERIAL PRIMARY KEY,
  shared_entry_id INTEGER NOT NULL REFERENCES shared_entries(id) ON DELETE CASCADE,
  timesheet_entry_id INTEGER NOT NULL REFERENCES timesheet(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shared_entry_id, timesheet_entry_id)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_shared_entry_items_shared ON shared_entry_items(shared_entry_id);

-- 3. Enable RLS
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_entry_items ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Allow anon and service_role to view shared_entries" ON shared_entries;
DROP POLICY IF EXISTS "Allow anon and service_role to insert shared_entries" ON shared_entries;
DROP POLICY IF EXISTS "Allow anon and service_role to update shared_entries" ON shared_entries;
DROP POLICY IF EXISTS "Allow anon and service_role to view shared_entry_items" ON shared_entry_items;
DROP POLICY IF EXISTS "Allow anon and service_role to insert shared_entry_items" ON shared_entry_items;

-- 5. Create RLS policies (following custom auth pattern)
-- Shared entries: Allow all SELECT queries (app-level security handles filtering)
CREATE POLICY "Allow anon and service_role to view shared_entries"
ON shared_entries FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- Shared entries: Allow all INSERT queries (app validates sharer_id matches current user)
CREATE POLICY "Allow anon and service_role to insert shared_entries"
ON shared_entries FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

-- Shared entries: Allow all UPDATE queries (app validates recipient_id matches current user)
CREATE POLICY "Allow anon and service_role to update shared_entries"
ON shared_entries FOR UPDATE
USING (auth.role() = 'anon' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

-- Shared entry items: Allow all SELECT queries
CREATE POLICY "Allow anon and service_role to view shared_entry_items"
ON shared_entry_items FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'service_role');

-- Shared entry items: Allow all INSERT queries
CREATE POLICY "Allow anon and service_role to insert shared_entry_items"
ON shared_entry_items FOR INSERT
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE shared_entries IS 'Tracks shared time entries between users';
COMMENT ON TABLE shared_entry_items IS 'Links shared entries to specific timesheet entries';
COMMENT ON COLUMN shared_entries.share_date IS 'For day shares: the specific date. For week shares: the Monday of the week';
COMMENT ON COLUMN shared_entries.status IS 'pending: waiting for recipient, accepted: recipient accepted, declined: recipient declined';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- After running this script, verify the tables were created:
-- 
-- SELECT * FROM shared_entries;
-- SELECT * FROM shared_entry_items;
-- SELECT * FROM pg_policies WHERE tablename IN ('shared_entries', 'shared_entry_items');
-- 
-- You should see:
-- - 2 tables created (shared_entries, shared_entry_items)
-- - 5 RLS policies created
-- ============================================
