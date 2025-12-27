# Stap-voor-stap: Edge Function Deployen

## Probleem
Je ziet in de Network tab:
- **Status: 404** voor `invite-user`
- **Status: CORS error** voor `invite-user`
- Toast melding: "Edge Function returned a non-2xx status code"

Dit betekent dat de Edge Function **niet bestaat** of **niet gedeployed** is.

## Oplossing: Deploy de Edge Function

### Stap 1: Open Supabase Dashboard
1. Ga naar: https://supabase.com/dashboard
2. Log in met je account
3. Selecteer je project: `bgddtkiekjcdhcmrnxsi` (of je project naam)

### Stap 2: Ga naar Edge Functions
1. Klik in het **linker menu** op **"Edge Functions"** (bliksem icoon)
2. Klik op **"Functions"** (of je ziet direct een lijst)

### Stap 3: Check of `invite-user` bestaat
Kijk in de lijst:
- **Zie je `invite-user` in de lijst?**
  - **JA** → Ga naar Stap 4B
  - **NEE** → Ga naar Stap 4A

### Stap 4A: Maak de Edge Function aan (als die NIET bestaat)

1. Klik op **"Create new edge function"** of **"Deploy a new function"** (groene knop rechtsboven)
2. Er opent een popup of nieuwe pagina
3. **Function name:** Typ exact: `invite-user`
   - ⚠️ **BELANGRIJK:** 
     - Kleine letters
     - Met streepje (niet underscore, niet spatie)
     - Exact zoals dit: `invite-user`
4. Klik op **"Create function"** of **"Create"**
5. Je ziet nu een code editor met wat voorbeeld code

### Stap 4B: Update de Edge Function (als die WEL bestaat)

1. Klik op **`invite-user`** in de lijst
2. Je ziet nu de code editor
3. Check of de code klopt (vergelijk met Stap 5)

### Stap 5: Kopieer de Code

1. Open het bestand in je project:
   - `time-track-teamwork-excel-main/supabase/functions/invite-user/index.ts`
   - Of open het in VS Code / je editor
2. **Selecteer ALLE code** (Ctrl + A)
3. **Kopieer** de code (Ctrl + C)

**Of kopieer deze code direct:**

```typescript
// Supabase Edge Function: invite-user
// Sends an invite email via Supabase's built-in email service and creates a user
//
// To deploy:
// 1) Install Supabase CLI (optional - can also deploy via Dashboard)
// 2) No additional secrets needed! Uses Supabase's built-in email service
// 3) Deploy via Dashboard or CLI: supabase functions deploy invite-user --project-ref bgddtkiekjcdhcmrnxsi
//
// Note: Supabase automatically provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// No Resend or external email service needed!

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type InvitePayload = {
  email: string;
  name: string;
  isAdmin?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, isAdmin = false } = (await req.json()) as InvitePayload;

    if (!email || !name) {
      return new Response(JSON.stringify({ error: "Email and name are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Supabase automatically provides these - no need to set as secrets!
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";
    
    // Use Supabase Auth's built-in invite function - this sends email automatically!
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { 
        name, 
        isAdmin: isAdmin ? "true" : "false" // Store as string in user metadata
      },
      redirectTo: `${appUrl}`, // Redirect URL after accepting invite (homepage)
    });

    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: authError?.message || "Failed to invite user",
        details: "Check if email is already registered or if Supabase email service is configured"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create matching row in public.users table
    // Generate a temporary password (user will set their own via email link)
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + "A1!";
    
    const { error: dbError } = await supabase.from("users").insert({
      id: user.id, // Use same ID as auth user
      email,
      name,
      password: tempPassword, // Temporary - user will change via email link
      isAdmin,
      must_change_password: true,
      approved: true, // Admins creating users are auto-approved
    });

    if (dbError) {
      // If user already exists in auth but not in users table, try update
      if (dbError.code === "23505") { // Unique constraint violation
        const { error: updateError } = await supabase
          .from("users")
          .update({ name, isAdmin, approved: true })
          .eq("id", user.id);
        
        if (updateError) {
          return new Response(JSON.stringify({ error: `Failed to create/update user: ${dbError.message}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
      } else {
        return new Response(JSON.stringify({ error: `Failed to create user: ${dbError.message}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: user.id,
      message: "User invited successfully. Invitation email sent via Supabase email service." 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

### Stap 6: Plak de Code in Supabase Editor

1. Ga terug naar Supabase Dashboard → Edge Functions → Functions → `invite-user`
2. **Verwijder ALLE code** die er al in staat (selecteer alles, delete)
3. **Plak** de gekopieerde code (Ctrl + V)
4. Check of de code correct is geplakt:
   - Staat er `Deno.serve(async (req) => {` aan het begin?
   - Zijn er geen syntax errors (rode onderstrepingen)?
   - Is de code compleet?

### Stap 7: Deploy de Function

1. Klik op **"Deploy function"** of **"Deploy"** (meestal rechtsboven of onderaan)
2. **WACHT** tot je een melding ziet:
   - ✅ "Function deployed successfully"
   - ✅ "Deployed"
   - ✅ "Function invite-user has been deployed"
3. Dit kan 10-30 seconden duren

### Stap 8: Verifieer Deployment

1. Ga terug naar **Edge Functions** → **Functions**
2. Check of `invite-user` in de lijst staat
3. Check de kolommen:
   - **NAME:** `invite-user` ✅
   - **URL:** Moet een URL bevatten ✅
   - **UPDATED:** Moet "just now" of "1 minute ago" zijn ✅
   - **DEPLOYMENTS:** Moet minimaal 1 zijn ✅

### Stap 9: Test opnieuw

1. Ga terug naar je website
2. **Refresh de pagina** (Ctrl + Shift + R om cache te clearen)
3. Open **Network tab** (F12 → Network)
4. Klik op **"Test Edge Function"** knop
5. Kijk in de Network tab:
   - **Status 200?** → ✅ Function werkt!
   - **Status 404?** → ❌ Function bestaat nog steeds niet, check Stap 8 opnieuw
   - **Status 401/403?** → ❌ Authentication probleem, check environment variables

## Veelvoorkomende Fouten

### Fout 1: Function name is verkeerd
- ❌ `InviteUser` (hoofdletters)
- ❌ `invite_user` (underscore)
- ❌ `invite user` (spatie)
- ✅ `invite-user` (kleine letters, met streepje)

### Fout 2: Code is niet compleet
- Check of alle code is geplakt
- Check of er geen syntax errors zijn (rode onderstrepingen in editor)

### Fout 3: Function is niet gedeployed
- Alleen aanmaken is niet genoeg!
- Je moet op **"Deploy function"** klikken
- Wacht tot je "Function deployed successfully" ziet

### Fout 4: Verkeerde project
- Check of je in het juiste Supabase project bent
- Project reference: `bgddtkiekjcdhcmrnxsi`

## Nog steeds 404?

Als je na deze stappen nog steeds 404 ziet:

1. **Check Supabase Dashboard:**
   - Staat `invite-user` in de Functions lijst?
   - Is de "UPDATED" tijd recent?
   - Is "DEPLOYMENTS" minimaal 1?

2. **Re-deploy:**
   - Ga naar `invite-user` → Edit
   - Klik opnieuw op "Deploy function"
   - Wacht 30 seconden
   - Test opnieuw

3. **Check URL:**
   - In de Functions lijst, wat is de URL?
   - Moet zijn: `https://bgddtkiekjcdhcmrnxsi.supabase.co/functions/v1/invite-user`

4. **Deel screenshot:**
   - Screenshot van Supabase Dashboard → Edge Functions → Functions
   - Dan kan ik precies zien wat er mis is

## Hulp nodig?

Deel een screenshot van:
1. Supabase Dashboard → Edge Functions → Functions (laat de lijst zien)
2. Als `invite-user` er is, klik erop en deel een screenshot van de code editor

Dan kan ik je precies vertellen wat er mis is!


















