# Volledige Timebuzzer Edge Function Code

## Wat moet je doen?

Kopieer deze volledige code en vervang de hele edge function in Supabase.

## Stap 1: Open Edge Function in Supabase

1. Ga naar **Supabase Dashboard**
2. Navigate naar **Edge Functions**
3. Klik op **"timebuzzer-sync"**
4. Klik op **"Edit"** of **"Update"**

## Stap 2: Vervang ALLE code

Selecteer ALLE code (Ctrl+A) en vervang met de code hieronder.

## Volledige Code

```typescript
// Timebuzzer Sync Edge Function
// This function syncs time entries from Timebuzzer API to the local timesheet
// Also supports fetching users, testing API endpoints, and syncing activities

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TimebuzzerActivity {
  id: number;
  userId: number;
  tiles: number[];
  startDate: string;
  endDate?: string;
  startUtcOffset?: string;
  endUtcOffset?: string;
  note?: string;
  billed?: boolean;
}

interface TimebuzzerUser {
  id: string;
  email: string;
  name?: string;
}

interface TimebuzzerTile {
  id: string;
  name: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get API key from environment
    const apiKey = Deno.env.get("TIMEBUZZER_API_KEY");
    if (!apiKey) {
      console.error("TIMEBUZZER_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "TIMEBUZZER_API_KEY not configured. Please add it in Edge Functions → Secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request body. Expected JSON.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { action } = body;

    console.log(`Received action: ${action}`);

    // ============================================
    // FETCH USERS ACTION
    // ============================================
    if (action === "fetch-users") {
      try {
        // Try account endpoint first (this is what test-api uses)
        const endpoint = "https://my.timebuzzer.com/open-api/account";
        
        console.log(`Fetching users from: ${endpoint}`);
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `APIKey ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API error: ${response.status}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const responseText = await response.text();
        
        // Check if response is HTML
        if (
          responseText.trim().toLowerCase().startsWith("<!doctype") ||
          responseText.trim().toLowerCase().startsWith("<html")
        ) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Timebuzzer API returned HTML instead of JSON",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const data = JSON.parse(responseText);
        
        // Extract users from account response (same structure as test-api uses)
        const users = data.users || data.account?.users || [];
        
        // Normalize user data
        const normalizedUsers = users.map((user: any) => ({
          id: user.id || user.userId || user.user_id,
          email: user.email || user.emailAddress || user.email_address || '',
          name: user.name || 
                (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) ||
                (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : null) ||
                user.displayName ||
                user.display_name ||
                '',
        })).filter((user: any) => user.id);

        return new Response(
          JSON.stringify({
            success: true,
            users: normalizedUsers,
            count: normalizedUsers.length,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        console.error("Error fetching users:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || "Failed to fetch users from Timebuzzer",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ============================================
    // TEST ACCOUNT ENDPOINT
    // ============================================
    if (action === "test-account") {
      try {
        const endpoint = "https://my.timebuzzer.com/open-api/account";
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `APIKey ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Account endpoint error: ${response.status}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const data = await response.json();
        const users = data.users || data.account?.users || [];

        return new Response(
          JSON.stringify({
            success: true,
            message: `Account endpoint working. Found ${users.length} users.`,
            usersCount: users.length,
            data: data,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || "Failed to test account endpoint",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ============================================
    // TEST TILES ENDPOINT
    // ============================================
    if (action === "test-tiles") {
      try {
        const endpoint = "https://my.timebuzzer.com/open-api/tiles";
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `APIKey ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Tiles endpoint error: ${response.status}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const data = await response.json();
        const tiles = Array.isArray(data) ? data : (data.items || data.tiles || []);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Tiles endpoint working. Found ${tiles.length} tiles/projects.`,
            count: tiles.length,
            data: tiles,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || "Failed to test tiles endpoint",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ============================================
    // TEST API ACTION (existing code)
    // ============================================
    if (action === "test-api") {
      // ... (keep all existing test-api code) ...
      // This is the existing test-api implementation
      // Don't change this, just add the new actions above
    }

    // ============================================
    // FETCH ACTIVITIES ACTION (existing code)
    // ============================================
    if (action === "fetch-activities") {
      // ... (keep all existing fetch-activities code) ...
      // This is the existing fetch-activities implementation
      // Don't change this, just add the new actions above
    }

    // ============================================
    // SYNC TO TIMESHEET ACTION (existing code)
    // ============================================
    if (action === "sync-to-timesheet") {
      // ... (keep all existing sync-to-timesheet code) ...
      // This is the existing sync-to-timesheet implementation
      // Don't change this, just add the new actions above
    }

    // ============================================
    // SYNC SELECTED ACTIVITIES ACTION (existing code)
    // ============================================
    if (action === "sync-selected-activities") {
      // ... (keep all existing sync-selected-activities code) ...
      // This is the existing sync-selected-activities implementation
      // Don't change this, just add the new actions above
    }

    // Unknown action
    return new Response(
      JSON.stringify({
        success: false,
        error: `Unknown action: ${action}. Supported actions: test-api, fetch-activities, sync-to-timesheet, sync-selected-activities, fetch-users, test-account, test-tiles`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // Log comprehensive error information
    const errorInfo = {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
      toString: String(error),
    };
    
    console.error("=== EDGE FUNCTION ERROR ===");
    console.error("Error name:", errorInfo.name);
    console.error("Error message:", errorInfo.message);
    console.error("Error stack:", errorInfo.stack);
    console.error("Error cause:", errorInfo.cause);
    console.error("Error string:", errorInfo.toString);
    console.error("Full error:", JSON.stringify(errorInfo, null, 2));
    console.error("===========================");
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Internal server error",
        errorType: error?.name || "Unknown",
        details: errorInfo.stack || errorInfo.toString,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

## Belangrijk

**JE MOET DE BESTAANDE CODE BEHOUDEN!**

De code hierboven toont alleen de **nieuwe acties** die je moet toevoegen. Je moet:

1. Je bestaande edge function code openen
2. De nieuwe acties (`fetch-users`, `test-account`, `test-tiles`) toevoegen **voor** de "Unknown action" return
3. De "Unknown action" error message updaten om de nieuwe acties te vermelden

**OF** als je de volledige code wilt, moet ik eerst je bestaande code zien om alles samen te voegen.

Laat me weten welke optie je wilt!



