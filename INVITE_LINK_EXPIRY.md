# Activatielink verlooptijd en redirect-URL

## Probleem: "Activatielink is verlopen" of gebruikers kunnen wachtwoord niet instellen

De activatielink in de uitnodigingsmail is een eenmalige token. De **geldigheidsduur** wordt bepaald door **Supabase Auth**, niet door de app. Staat die in Supabase te kort (bijv. 1 uur), dan is de link al verlopen wanneer de gebruiker opent. De mail zegt "valid for 7 days"; dat klopt alleen als Supabase ook op 7 dagen staat.

## 1. Link verlooptijd op 7 dagen zetten (Supabase)

1. Ga naar [Supabase Dashboard](https://supabase.com/dashboard) en kies je project.
2. Ga naar **Authentication** → **Settings** (of **Project Settings** → **Auth**).
3. Zoek naar **Rate limits** of **Mailer**.
4. Zoek de instelling voor **Magic link** of **OTP** validity (meestal in seconden).
5. Zet de waarde op **604800** (7 dagen in seconden), of op het maximum dat het dashboard toelaat (bijv. 86400 = 24 uur als 7 dagen niet kan).

De uitnodigingsmail vermeldt "valid for 7 days"; zorg dat de Supabase-waarde daarmee overeenkomt (bijv. 604800 seconden).

## 2. Redirect-URL voor invite-confirm

Zorg dat de app-URL in Supabase is toegestaan:

1. Ga naar **Authentication** → **URL configuration** (of **Redirect URLs**).
2. Voeg toe (als die nog niet staat):
   - `https://bampro-uren.nl/invite-confirm`
   - De exacte site-URL van je app (bijv. `https://bampro-uren.nl`).

Dit voorkomt problemen met CORS of redirects na activatie.

## 3. RLS: wachtwoord-update na activatie

Na het klikken op de activatielink zet de app het wachtwoord in Supabase Auth én in de tabel `public.users`. Als RLS op `public.users` de UPDATE blokkeert, kan de gebruiker daarna niet inloggen (de app gebruikt `public.users` voor login).

- Als je **FIX_ALL_RLS_DEFINITIVE.sql** hebt gedraaid, staat er al een policy die anon/service_role toestaat; dan is geen extra actie nodig.
- Gebruik je strengere RLS (bijv. "alleen eigen rij"), zorg dan dat UPDATE is toegestaan voor de ingelogde gebruiker (bijv. `auth.uid() = id`), zodat de update na `setSession` op de invite-confirm-pagina slaagt.

## 4. Nieuwe link sturen (link verlopen of al gebruikt)

Een beheerder kan opnieuw een uitnodiging sturen naar het **zelfde e-mailadres**. De Edge Function stuurt dan een **nieuwe** (recovery-)link; de gebruiker opent die en stelt het wachtwoord in op de pagina `/reset`. In het Admin-panel kun je eventueel een knop **"Stuur uitnodiging opnieuw"** gebruiken om dit zonder het formulier opnieuw in te vullen te doen.
