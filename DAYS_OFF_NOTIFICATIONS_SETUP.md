# Days Off Notifications Setup

## Probleem
De tabel `days_off_notifications` bestaat nog niet in Supabase, waardoor notificaties niet kunnen worden aangemaakt.

## Oplossing

### Stap 1: Maak de tabel aan in Supabase

1. Ga naar je Supabase project dashboard
2. Klik op "SQL Editor" in het linker menu
3. Klik op "New query"
4. Kopieer en plak de volgende SQL code:

```sql
-- Create days_off_notifications table for storing days off change notifications
CREATE TABLE IF NOT EXISTS public.days_off_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  hours_changed NUMERIC NOT NULL, -- Positive for added, negative for deducted
  days_changed NUMERIC NOT NULL, -- Calculated from hours (hours / 8)
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_by TEXT, -- admin user id who made the change
  admin_name TEXT -- admin name for display
);

-- Enable RLS
ALTER TABLE public.days_off_notifications ENABLE ROW LEVEL SECURITY;
```

5. Klik op "Run" om de tabel aan te maken

### Stap 2: Fix RLS Policies voor Custom Authentication

Na het aanmaken van de tabel, run dit script om de RLS policies correct in te stellen:

```sql
-- Drop existing policies first (als ze bestaan)
DROP POLICY IF EXISTS "Anyone can insert days off notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.days_off_notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.days_off_notifications;

-- Policy: Anyone can insert notifications (admins when making changes)
CREATE POLICY "Anyone can insert days off notifications" ON public.days_off_notifications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own notifications
-- For custom auth, we allow all selects, app will filter by user_id
CREATE POLICY "Users can view their own notifications" ON public.days_off_notifications
  FOR SELECT
  USING (true);

-- Policy: Users can update their own notifications (to mark as read)
CREATE POLICY "Users can update their own notifications" ON public.days_off_notifications
  FOR UPDATE
  USING (true);

-- Policy: Admins can delete notifications
CREATE POLICY "Admins can delete notifications" ON public.days_off_notifications
  FOR DELETE
  USING (true);
```

### Stap 3: Maak indexes aan (optioneel, voor betere performance)

```sql
-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_user_id ON public.days_off_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_read_at ON public.days_off_notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_user_unread ON public.days_off_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_days_off_notifications_created_at ON public.days_off_notifications(created_at DESC);
```

### Stap 4: Test het systeem

1. Refresh de pagina in je browser
2. Log in als admin
3. Pas days off aan voor een gebruiker
4. Check de browser console - je zou moeten zien: "Notification created successfully"
5. Log in als die gebruiker
6. Je zou een pop-up moeten zien met de days off update
7. De "Vrije Dagen Over" widget zou een oranje ring en badge moeten tonen

## Troubleshooting

### Als je nog steeds errors ziet:

1. **Check of de tabel bestaat:**
   - Ga naar Supabase Dashboard → Table Editor
   - Zoek naar `days_off_notifications`
   - Als deze niet bestaat, run Stap 1 opnieuw

2. **Check RLS policies:**
   - Ga naar Supabase Dashboard → Authentication → Policies
   - Zoek naar policies voor `days_off_notifications`
   - Als ze niet bestaan, run Stap 2 opnieuw

3. **Check browser console:**
   - Open Developer Tools (F12)
   - Kijk naar errors in de Console tab
   - Deel de error messages als je hulp nodig hebt

## Bestanden

- `create_days_off_notifications_table.sql` - Maakt de tabel aan
- `fix_days_off_notifications_rls.sql` - Fix RLS policies voor custom auth

