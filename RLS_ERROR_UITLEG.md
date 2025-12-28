# Wat betekent "new row violates row-level security policy"?

## Korte Uitleg

Deze fout betekent dat **Row Level Security (RLS)** is ingeschakeld op de `users` tabel, maar er is **geen policy** die toestaat dat een nieuwe user wordt aangemaakt.

## Wat is Row Level Security (RLS)?

RLS is een beveiligingssysteem in Supabase/PostgreSQL dat bepaalt wie welke data kan zien, aanmaken, wijzigen of verwijderen. Het werkt als een extra laag beveiliging bovenop je applicatie code.

## Waarom krijg je deze fout?

Er zijn twee scenario's:

### Scenario 1: Edge Function gebruikt service_role (GOED)
- Edge Functions gebruiken automatisch `service_role` key
- `service_role` **bypassed normaal gesproken RLS**
- **MAAR:** Als er geen INSERT policy is die `service_role` toestaat, krijg je deze fout

### Scenario 2: Directe insert vanuit AdminPanel (FOUT)
- AdminPanel gebruikt `anon` key (client-side)
- `anon` key heeft **geen** speciale rechten
- Als RLS is ingeschakeld, moet er een policy zijn die `anon` toestaat om users aan te maken
- **Dit is NIET veilig** - daarom moet je Edge Functions gebruiken

## Oplossing

### Stap 1: Voer RLS Fix Script Uit

1. **Ga naar Supabase Dashboard** → **SQL Editor**
2. **Kopieer ALLE code** uit `fix_invite_user_rls_COMPLETE.sql`
3. **Plak** in SQL Editor
4. **Klik op "Run"**
5. **Check** of je ziet: "Service role can insert users" policy

Dit script maakt een policy die toestaat dat `service_role` (Edge Functions) users kan aanmaken.

### Stap 2: Zorg dat Edge Function wordt Gebruikt

De AdminPanel code probeert eerst de Edge Function te gebruiken. Als die faalt, valt het terug op directe insert (wat niet werkt met RLS).

**Check:**
- Is de Edge Function gedeployed? (Supabase Dashboard → Edge Functions → Functions → `invite-user`)
- Geeft de Edge Function een 500 error? (check logs)
- Als ja, fix de Edge Function eerst

### Stap 3: Test Opnieuw

Na het uitvoeren van het SQL script zou de Edge Function users moeten kunnen aanmaken.

## Belangrijk

- **Edge Functions** gebruiken `service_role` → kunnen RLS bypassen (met juiste policy)
- **Client-side code** gebruikt `anon` key → kan NIET RLS bypassen
- **Oplossing:** Gebruik altijd Edge Functions voor user creation

## Als het nog steeds niet werkt

Check:
1. Is RLS ingeschakeld? (Supabase Dashboard → Table Editor → `users` → Settings → RLS enabled?)
2. Bestaat de policy? (Run het SQL script en check de resultaten)
3. Gebruikt de Edge Function `service_role`? (Ja, automatisch)
4. Zijn er meerdere INSERT policies die elkaar blokkeren? (Het script dropt alle oude policies)

