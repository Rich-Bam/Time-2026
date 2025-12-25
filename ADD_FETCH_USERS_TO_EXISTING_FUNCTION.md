# Fetch Users Toevoegen aan Bestaande Edge Function

## Wat moet je doen?

Je hebt al een uitgebreide `timebuzzer-sync` edge function in Supabase. Je moet de `fetch-users` actie toevoegen.

## Stap 1: Open de Edge Function in Supabase

1. Ga naar **Supabase Dashboard**
2. Navigate naar **Edge Functions**
3. Klik op **"timebuzzer-sync"**
4. Klik op **"Edit"** of **"Update"**

## Stap 2: Voeg de fetch-users actie toe

Zoek naar deze regel in je code (ongeveer aan het einde, voor "Unknown action"):

```typescript
    if (action === "sync-selected-activities") {
      // ... bestaande code ...
    }

    // Unknown action
    return new Response(
      JSON.stringify({
        success: false,
        error: `Unknown action: ${action}. Supported actions: test-api, fetch-activities, sync-to-timesheet, sync-selected-activities`,
      }),
```

**Vervang dit door:**

```typescript
    if (action === "sync-selected-activities") {
      // ... bestaande code blijft hetzelfde ...
    }

    if (action === "fetch-users") {
      // Fetch all users from Timebuzzer
      try {
        // Try multiple possible endpoints
        const endpoints = [
          "https://my.timebuzzer.com/open-api/users",
          "https://my.timebuzzer.com/open-api/account", // Account endpoint might have users
        ];
        
        let users: any[] = [];
        let lastError: any = null;
        
        // Try each endpoint
        for (const endpoint of endpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint}`);
            const response = await fetch(endpoint, {
              headers: {
                Authorization: `APIKey ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
            });

            if (!response.ok) {
              console.log(`Endpoint ${endpoint} returned status ${response.status}`);
              continue;
            }

            const responseText = await response.text();
            
            // Check if response is HTML (error page)
            if (
              responseText.trim().toLowerCase().startsWith("<!doctype") ||
              responseText.trim().toLowerCase().startsWith("<html")
            ) {
              console.log(`Endpoint ${endpoint} returned HTML instead of JSON`);
              continue;
            }

            // Try to parse as JSON
            let data;
            try {
              data = JSON.parse(responseText);
            } catch (parseError) {
              console.log(`Endpoint ${endpoint} returned invalid JSON`);
              continue;
            }

            // Handle different response formats
            if (Array.isArray(data)) {
              users = data;
            } else if (data.users && Array.isArray(data.users)) {
              users = data.users;
            } else if (data.account && data.account.users && Array.isArray(data.account.users)) {
              users = data.account.users;
            } else if (data.data && Array.isArray(data.data)) {
              users = data.data;
            } else if (data.results && Array.isArray(data.results)) {
              users = data.results;
            }

            if (users.length > 0) {
              console.log(`Found ${users.length} users from endpoint ${endpoint}`);
              break; // Success, stop trying other endpoints
            }
          } catch (error: any) {
            console.error(`Error trying endpoint ${endpoint}:`, error);
            lastError = error;
            continue;
          }
        }

        if (users.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "No users found. Tried multiple endpoints but none returned users.",
              suggestion: "Check Timebuzzer API documentation for the correct users endpoint, or verify your API key has access to user data.",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

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
        })).filter((user: any) => user.id); // Filter out users without ID

        console.log(`Normalized ${normalizedUsers.length} users`);

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

    // Unknown action
    return new Response(
      JSON.stringify({
        success: false,
        error: `Unknown action: ${action}. Supported actions: test-api, fetch-activities, sync-to-timesheet, sync-selected-activities, fetch-users`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
```

## Stap 3: Update de "Unknown action" error message

Zorg dat de error message ook `fetch-users` bevat in de lijst van supported actions.

## Stap 4: Deploy

1. Klik op **"Deploy"** of **"Save"**
2. Wacht tot de deployment klaar is

## Klaar!

Nu kun je de "Fetch All Timebuzzer Users" knop gebruiken in je Admin Panel!



