# Screenshot Functionaliteit Setup

Deze handleiding legt uit hoe je de screenshot functionaliteit instelt.

## Stap 1: Database Tabel Aanmaken

1. Ga naar **Supabase Dashboard** → **SQL Editor**
2. Kopieer en plak de inhoud van `create_screenshots_table.sql`
3. Klik op **Run** om de tabel aan te maken

## Stap 2: Storage Bucket Aanmaken

1. Ga naar **Supabase Dashboard** → **Storage**
2. Klik op **New bucket**
3. Bucket name: `screenshots`
4. **Public bucket**: ✅ Aan (zodat screenshots zichtbaar zijn)
5. Klik op **Create bucket**

### Storage Policies Instellen

Na het aanmaken van de bucket, ga naar **Policies** en voeg toe:

**Policy 1: Upload (Insert)**
- Policy name: `Allow authenticated uploads`
- Allowed operation: `INSERT`
- Policy definition:
```sql
(role() = 'authenticated')
```

**Policy 2: Read (Select)**
- Policy name: `Allow public reads`
- Allowed operation: `SELECT`
- Policy definition:
```sql
(true)
```

**Policy 3: Delete**
- Policy name: `Allow authenticated deletes`
- Allowed operation: `DELETE`
- Policy definition:
```sql
(role() = 'authenticated')
```

## Stap 3: Testen

1. Log in als admin
2. Je ziet nu een **Screenshot** knop in de header (camera icoon)
3. Klik op de knop om een screenshot te maken
4. Als super admin (r.blance@bampro.nl), ga naar **Admin Panel**
5. Scroll naar beneden naar **"Bug Report Screenshots"** sectie
6. Je zou de screenshot moeten zien

## Functionaliteit

- **Admins** kunnen screenshots maken met de camera knop in de header
- Screenshots worden automatisch opgeslagen in Supabase Storage
- Metadata (wie, wanneer) wordt opgeslagen in de database
- **Super Admin** kan alle screenshots bekijken in het Admin Panel
- Super Admin kan screenshots verwijderen

## Troubleshooting

### "Storage Bucket Ontbreekt" error
- Maak de `screenshots` bucket aan in Supabase Dashboard → Storage
- Zorg dat de bucket **public** is

### "Database Tabel Ontbreekt" error
- Voer het SQL script uit in Supabase Dashboard → SQL Editor
- Check of de tabel `public.screenshots` bestaat

### Screenshots niet zichtbaar
- Check of de bucket **public** is ingesteld
- Check of de storage policies correct zijn ingesteld
- Check browser console (F12) voor errors





