# Deploy update-password Edge Function

## Waarom deze function?

De password reset werkt in Supabase Auth, maar de applicatie gebruikt een custom `users` tabel voor login. De `users` tabel update faalt vaak door RLS (Row Level Security) policies. Deze edge function gebruikt `service_role` om RLS te omzeilen.

## Stap 1: Deploy de Edge Function

1. Ga naar **Supabase Dashboard** → **Edge Functions**
2. Klik op **"Create a new function"** of **"New Function"**
3. Naam: `update-password`
4. Kopieer ALLE code uit `supabase/functions/update-password/index.ts`
5. Plak in de editor
6. Klik op **"Deploy"** of **"Save"**

## Stap 2: Verificatie

1. Ga naar **Edge Functions** → **Functions**
2. Je zou `update-password` moeten zien in de lijst
3. Check of de status "Active" is

## Stap 3: Test Password Reset

1. Ga naar de login pagina
2. Klik op "Wachtwoord Vergeten?"
3. Voer je email in en verstuur
4. Klik op de reset link in de email
5. Stel een nieuw wachtwoord in
6. Probeer in te loggen met het nieuwe wachtwoord
7. Het zou nu moeten werken! ✅

## Troubleshooting

**Edge Function niet gevonden?**
- Check of de function is gedeployed
- Check de naam (moet exact `update-password` zijn)
- Check Supabase Dashboard → Edge Functions → Functions

**Password reset werkt nog steeds niet?**
- Check browser console (F12) voor errors
- Check of de edge function wordt aangeroepen
- Check Supabase Dashboard → Edge Functions → Logs voor errors

## Hoe het werkt

1. Gebruiker reset wachtwoord via Supabase Auth (standaard flow)
2. Reset.tsx pagina hash het nieuwe wachtwoord
3. Reset.tsx roept de `update-password` edge function aan
4. Edge function update de `users` tabel met service_role (bypass RLS)
5. Login werkt nu met het nieuwe wachtwoord! ✅


