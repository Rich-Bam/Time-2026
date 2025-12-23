# Supabase Setup voor Screenshot Functionaliteit

**BELANGRIJK:** Voer deze stappen uit in Supabase voordat je de code pusht en test.

---

## 📋 Overzicht

Je moet 2 dingen doen in Supabase:
1. **Database tabel aanmaken** (voor screenshot metadata)
2. **Storage bucket aanmaken** (voor de screenshot afbeeldingen)

---

## ✅ STAP 1: Database Tabel Aanmaken

### 1.1. Ga naar Supabase Dashboard
1. Open: https://supabase.com/dashboard
2. Log in met je account
3. Selecteer je project (waarschijnlijk `bgddtkiekjcdhcmrnxsi`)

### 1.2. Open SQL Editor
1. Klik in het linker menu op **"SQL Editor"** (of **"SQL"**)
2. Klik op **"New query"** (of **"+"** knop)

### 1.3. Kopieer en Plak SQL Code
1. Open het bestand: `create_screenshots_table.sql`
2. **Kopieer ALLE code** uit dat bestand
3. **Plak** de code in de SQL Editor in Supabase

### 1.4. Voer het Script Uit
1. Klik op **"Run"** (of druk op `Ctrl+Enter`)
2. Je zou moeten zien: **"Success. No rows returned"**
3. ✅ **Klaar!** De tabel is aangemaakt

### 1.5. Verificatie (Optioneel)
1. Ga naar **"Table Editor"** in het linker menu
2. Je zou nu een tabel moeten zien genaamd **"screenshots"**
3. Klik erop om de structuur te bekijken

---

## ✅ STAP 2: Storage Bucket Aanmaken

### 2.1. Ga naar Storage
1. Klik in het linker menu op **"Storage"**
2. Je ziet een lijst met buckets (mogelijk leeg)

### 2.2. Maak Nieuwe Bucket
1. Klik op **"New bucket"** (of **"Create bucket"**)
2. Vul in:
   - **Name:** `screenshots` (exact zoals dit, kleine letters)
   - **Public bucket:** ✅ **AAN** (zet het vinkje aan!)
   - **File size limit:** Laat leeg of zet op `10 MB`
   - **Allowed MIME types:** Laat leeg (of zet `image/png`)
3. Klik op **"Create bucket"**

### 2.3. Storage Policies Instellen

Nu moet je 3 policies toevoegen zodat de app screenshots kan uploaden en bekijken:

#### Policy 1: Upload (INSERT)
1. Klik op de bucket **"screenshots"** die je net hebt aangemaakt
2. Klik op het tabblad **"Policies"**
3. Klik op **"New policy"** (of **"Add policy"**)
4. Kies: **"Create a policy from scratch"** (of **"For full customization"**)
5. Vul in:
   - **Policy name:** `Allow authenticated uploads`
   - **Allowed operation:** Selecteer **"INSERT"**
   - **Policy definition:** Plak dit:
     ```sql
     (bucket_id = 'screenshots'::text)
     ```
   - **WITH CHECK expression:** Plak dit:
     ```sql
     (bucket_id = 'screenshots'::text)
     ```
6. Klik op **"Review"** en dan **"Save policy"**

#### Policy 2: Read (SELECT)
1. Klik op **"New policy"** opnieuw
2. Vul in:
   - **Policy name:** `Allow public reads`
   - **Allowed operation:** Selecteer **"SELECT"**
   - **Policy definition:** Plak dit:
     ```sql
     (bucket_id = 'screenshots'::text)
     ```
3. Klik op **"Review"** en dan **"Save policy"**

#### Policy 3: Delete
1. Klik op **"New policy"** opnieuw
2. Vul in:
   - **Policy name:** `Allow authenticated deletes`
   - **Allowed operation:** Selecteer **"DELETE"**
   - **Policy definition:** Plak dit:
     ```sql
     (bucket_id = 'screenshots'::text)
     ```
3. Klik op **"Review"** en dan **"Save policy"**

### 2.4. Verificatie
Je zou nu 3 policies moeten zien:
- ✅ Allow authenticated uploads (INSERT)
- ✅ Allow public reads (SELECT)
- ✅ Allow authenticated deletes (DELETE)

---

## ✅ STAP 3: Testen (Na Code Push)

Nadat je de code hebt gepusht en de website is geüpdatet:

1. **Log in als admin** op je website
2. Je ziet nu een **camera icoon** knop in de header (rechtsboven)
3. Klik op de **"Screenshot"** knop
4. Je zou een melding moeten zien: **"Screenshot Opgeslagen"**
5. **Log in als super admin** (r.blance@bampro.nl)
6. Ga naar **Admin Panel**
7. Scroll helemaal naar beneden
8. Je zou een sectie moeten zien: **"Bug Report Screenshots"**
9. Je screenshot zou daar moeten verschijnen!

---

## ❌ Troubleshooting

### Fout: "Storage Bucket Ontbreekt"
- **Oplossing:** Maak de bucket `screenshots` aan in Storage (Stap 2.2)
- Check of de naam exact `screenshots` is (kleine letters)

### Fout: "Database Tabel Ontbreekt"
- **Oplossing:** Voer het SQL script uit in SQL Editor (Stap 1)
- Check of de tabel `screenshots` bestaat in Table Editor

### Fout: "Permission denied" of "Policy violation"
- **Oplossing:** Check of alle 3 policies zijn aangemaakt (Stap 2.3)
- Check of de bucket **public** is (Stap 2.2)

### Screenshots niet zichtbaar in Admin Panel
- Check of je ingelogd bent als super admin (r.blance@bampro.nl)
- Check browser console (F12) voor errors
- Check of de screenshot wel is geüpload (ga naar Storage → screenshots bucket)

---

## 📝 Checklist

Voordat je de code pusht, check dit:

- [ ] Database tabel `screenshots` is aangemaakt (Stap 1)
- [ ] Storage bucket `screenshots` is aangemaakt (Stap 2.2)
- [ ] Bucket is **public** (Stap 2.2)
- [ ] 3 Policies zijn aangemaakt (Stap 2.3)
  - [ ] Allow authenticated uploads (INSERT)
  - [ ] Allow public reads (SELECT)
  - [ ] Allow authenticated deletes (DELETE)

---

## 🎯 Klaar!

Als alle stappen zijn uitgevoerd, kun je de code pushen. De screenshot functionaliteit zou dan moeten werken!

**Vragen?** Check de browser console (F12) voor errors als iets niet werkt.









