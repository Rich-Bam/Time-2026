// Timebuzzer Sync Edge Function
// This function syncs time entries from Timebuzzer API to the local timesheet

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TimebuzzerActivity {
  id: number;
  userId: number; // Note: API uses userId, not user_id
  tiles: number[]; // Note: API uses tiles array, not tile_id
  startDate: string; // Note: API uses startDate, not start_time
  endDate?: string; // Note: API uses endDate, not end_time
  startUtcOffset?: string;
  endUtcOffset?: string;
  note?: string; // Note: API uses note, not description
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

    // Handle different actions
    if (action === "test-api") {
      // Test API connection - try multiple possible endpoints
      const userId = body.userId; // Optional: filter by specific user
      console.log("Testing Timebuzzer API connection...");
      if (userId) {
        console.log(`Filtering by Timebuzzer user ID: ${userId}`);
      }
      console.log(`API Key present: ${apiKey ? 'Yes' : 'No'}`);
      console.log(`API Key length: ${apiKey ? apiKey.length : 0}`);
      console.log(`API Key starts with: ${apiKey ? apiKey.substring(0, 20) + '...' : 'N/A'}`);
      
      // Try to decode JWT to check expiration (if it's a JWT)
      if (apiKey && apiKey.includes('.')) {
        try {
          const parts = apiKey.split('.');
          if (parts.length === 3) {
            // Decode JWT payload (base64)
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            console.log(`JWT Payload decoded:`, JSON.stringify(payload, null, 2));
            if (payload.exp) {
              const expirationDate = new Date(payload.exp * 1000);
              const now = new Date();
              console.log(`Token expiration date: ${expirationDate.toISOString()}`);
              console.log(`Current time: ${now.toISOString()}`);
              const isExpired = now > expirationDate;
              console.log(`Token expired: ${isExpired ? 'YES ⚠️' : 'NO ✅'}`);
              if (isExpired) {
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: "API key (JWT token) has EXPIRED",
                    expirationDate: expirationDate.toISOString(),
                    currentTime: now.toISOString(),
                    suggestion: "Please generate a NEW API key in Timebuzzer Settings → API and update the TIMEBUZZER_API_KEY secret in Supabase Edge Functions → Secrets",
                  }),
                  {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  }
                );
              }
            }
            if (payload.email) {
              console.log(`Token email: ${payload.email}`);
            }
            if (payload.ts) {
              console.log(`Token timestamp: ${payload.ts}`);
            }
          }
        } catch (e) {
          // Not a JWT or can't decode, that's okay
          console.log("API key is not a JWT or can't be decoded:", e);
        }
      }
      
      // Use the correct endpoint from Timebuzzer API documentation
      // According to docs: https://my.timebuzzer.com/open-api/activities?count={count}&offset={offset}
      // If userId is provided, we'll filter the results after fetching
      const endpoint = "https://my.timebuzzer.com/open-api/activities?count=100&offset=0"; // Increased count to get more activities for filtering
      
      try {
        // Use the correct endpoint from Timebuzzer API documentation
        console.log(`Calling endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `APIKey ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        });

        console.log(`API Response Status: ${response.status}`);
        const contentType = response.headers.get("content-type");
        console.log(`Content-Type: ${contentType}`);
        
        const responseText = await response.text();
        console.log(`Response preview: ${responseText.substring(0, 200)}`);

        // Check if response is HTML (error page)
        if (responseText.trim().toLowerCase().startsWith('<!doctype') || 
            responseText.trim().toLowerCase().startsWith('<html')) {
          console.error('Timebuzzer API returned HTML instead of JSON');
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API returned HTML instead of JSON. Status: ${response.status}. This usually means the API key is invalid or expired.`,
              details: responseText.substring(0, 500),
              suggestion: "Please check: 1) Verify the API key is correct in Timebuzzer Settings → API 2) Generate a new API key if the current one might be expired 3) Test the API key directly with curl or Postman",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError: any) {
          console.error('Failed to parse JSON response:', parseError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API returned invalid JSON. Response starts with: ${responseText.substring(0, 100)}`,
              details: responseText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check if response has the expected structure (from API docs: {totalCount, totalDuration, activities: [...]})
        if (data.activities && Array.isArray(data.activities)) {
          console.log(`API returned ${data.activities.length} activities (totalCount: ${data.totalCount || 'N/A'})`);
          
          // Fetch users and tiles to get names
          let usersMap = new Map<number, { firstName: string; lastName: string; email: string }>();
          let tilesMap = new Map<number, string>();
          
          try {
            // Fetch account info to get users
            console.log('Fetching account info to get user names...');
            const accountResponse = await fetch("https://my.timebuzzer.com/open-api/account", {
              headers: {
                Authorization: `APIKey ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
            });
            
            if (accountResponse.ok) {
              const accountData = await accountResponse.json();
              if (accountData.users && Array.isArray(accountData.users)) {
                accountData.users.forEach((user: any) => {
                  usersMap.set(user.id, {
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    email: user.email || '',
                  });
                });
                console.log(`Fetched ${usersMap.size} users from account endpoint`);
              }
            } else {
              console.log(`Failed to fetch account info: ${accountResponse.status}`);
            }
          } catch (e) {
            console.error('Error fetching account info:', e);
          }
          
          try {
            // Fetch tiles to get project names
            console.log('Fetching tiles to get project names...');
            const tilesResponse = await fetch("https://my.timebuzzer.com/open-api/tiles", {
              headers: {
                Authorization: `APIKey ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
            });
            
            if (tilesResponse.ok) {
              const tilesData = await tilesResponse.json();
              if (Array.isArray(tilesData)) {
                tilesData.forEach((tile: any) => {
                  tilesMap.set(tile.id, tile.name || `Tile ${tile.id}`);
                });
                console.log(`Fetched ${tilesMap.size} tiles from tiles endpoint`);
              } else if (tilesData.items && Array.isArray(tilesData.items)) {
                tilesData.items.forEach((tile: any) => {
                  tilesMap.set(tile.id, tile.name || `Tile ${tile.id}`);
                });
                console.log(`Fetched ${tilesMap.size} tiles from tiles endpoint`);
              }
            } else {
              console.log(`Failed to fetch tiles: ${tilesResponse.status}`);
            }
          } catch (e) {
            console.error('Error fetching tiles:', e);
          }
          
          // Filter activities by userId if specified
          let activitiesToProcess = data.activities;
          if (userId) {
            const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
            activitiesToProcess = data.activities.filter((activity: any) => activity.userId === userIdNum);
            console.log(`Filtered activities: ${activitiesToProcess.length} of ${data.activities.length} match user ID ${userId}`);
          }
          
          // Enrich activities with user and tile names
          const enrichedActivities = activitiesToProcess.map((activity: any) => {
            const user = usersMap.get(activity.userId);
            const tileNames = activity.tiles
              ? activity.tiles.map((tileId: number) => tilesMap.get(tileId) || `Tile ${tileId}`)
              : [];
            
            return {
              ...activity,
              userName: user ? `${user.firstName} ${user.lastName}`.trim() || user.email : `User ${activity.userId}`,
              userEmail: user?.email || '',
              tileNames: tileNames,
            };
          });
          
          return new Response(
            JSON.stringify({
              success: true,
              status: "API connection successful",
              endpoint: endpoint,
              data: {
                ...data,
                activities: enrichedActivities,
              },
              count: data.activities.length,
              totalCount: data.totalCount,
              totalDuration: data.totalDuration,
              usersFetched: usersMap.size,
              tilesFetched: tilesMap.size,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else if (Array.isArray(data)) {
          // If it's just an array
          console.log(`API returned ${data.length} items`);
          return new Response(
            JSON.stringify({
              success: true,
              status: "API connection successful",
              endpoint: endpoint,
              data: data,
              count: data.length,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else {
          // Unexpected structure, but still return success
          console.log(`API returned data with unexpected structure:`, Object.keys(data));
          return new Response(
            JSON.stringify({
              success: true,
              status: "API connection successful (unexpected response structure)",
              endpoint: endpoint,
              data: data,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (error: any) {
        console.error("Test API error:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to connect to Timebuzzer API: ${error.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

    }

    if (action === "fetch-activities") {
      // Fetch activities for a date range
      const { startDate, endDate } = body;

      if (!startDate || !endDate) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "startDate and endDate are required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      try {
        // Use the filtered activities endpoint from Timebuzzer API documentation
        // POST https://my.timebuzzer.com/open-api/activities/filters
        // Note: We don't filter by userId in the API request because:
        // 1. The API may not support it
        // 2. The API key may only have access to certain users
        // 3. We'll filter client-side after fetching all available activities
        const requestBody: any = {
          startDate: `${startDate}T00:00:00.000`,
          endDate: `${endDate}T23:59:59.999`,
          strictDate: false,
        };
        
        const requestedUserId = body.userId;
        if (requestedUserId && action === "fetch-activities") {
          console.log(`Will filter by user ID ${requestedUserId} after fetching activities from API`);
        }
        
        console.log(`Fetching activities from Timebuzzer API with date range: ${requestBody.startDate} to ${requestBody.endDate}`);
        
        const response = await fetch(
          "https://my.timebuzzer.com/open-api/activities/filters?offset=0&count=1000",
          {
            method: "POST",
            headers: {
              Authorization: `APIKey ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API error: ${response.status}`,
              details: errorText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check if response is JSON before parsing
        const responseText = await response.text();
        
        // Check if response is HTML (error page)
        if (responseText.trim().toLowerCase().startsWith('<!doctype') || 
            responseText.trim().toLowerCase().startsWith('<html')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API returned an HTML error page. Status: ${response.status}`,
              details: responseText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Try to parse as JSON
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError: any) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API returned invalid JSON. Response starts with: ${responseText.substring(0, 100)}`,
              details: responseText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // The filtered activities endpoint returns {totalCount, totalDuration, activities: [...]}
        let activities: TimebuzzerActivity[] = responseData.activities || (Array.isArray(responseData) ? responseData : []);

        console.log(`Received ${activities.length} activities from Timebuzzer API (totalCount: ${responseData.totalCount || 'N/A'})`);
        
        // Log all unique user IDs in the response for debugging
        if (activities.length > 0) {
          const uniqueUserIds = [...new Set(activities.map((a: any) => a.userId))];
          console.log(`Unique user IDs in API response: ${uniqueUserIds.join(', ')}`);
          console.log(`Activity count per user:`, uniqueUserIds.map(uid => {
            const count = activities.filter((a: any) => a.userId === uid).length;
            return `${uid}: ${count}`;
          }).join(', '));
        }

        // Client-side filtering by userId if specified (for fetch-activities action)
        // This is necessary because the API may not support userId filtering in the request body
        // or the API key may have limited access
        if (requestedUserId && action === "fetch-activities") {
          const userIdNum = typeof requestedUserId === 'string' ? parseInt(requestedUserId, 10) : requestedUserId;
          const activitiesBeforeFilter = activities.length;
          console.log(`Filtering activities by user ID: ${requestedUserId} (as number: ${userIdNum})`);
          console.log(`Total activities before filter: ${activities.length}`);
          
          if (activities.length > 0) {
            const sampleUserIds = activities.slice(0, 10).map((a: any) => a.userId);
            console.log(`Sample activity userIds (first 10): ${sampleUserIds.join(', ')}`);
          }
          
          activities = activities.filter((activity: TimebuzzerActivity) => {
            const matches = activity.userId === userIdNum;
            if (!matches && activitiesBeforeFilter <= 10) {
              // Log first few non-matching activities for debugging
              console.log(`Activity ${activity.id} has userId ${activity.userId}, not matching ${userIdNum}`);
            }
            return matches;
          });
          
          console.log(`After filtering: ${activities.length} of ${activitiesBeforeFilter} activities match user ${userIdNum}`);
          
          if (activities.length === 0 && activitiesBeforeFilter > 0) {
            const uniqueUserIds = [...new Set(responseData.activities?.map((a: any) => a.userId) || [])];
            console.log(`⚠️ No activities found for user ${userIdNum}. Available user IDs in this date range: ${uniqueUserIds.join(', ')}`);
            console.log(`This could mean:`);
            console.log(`  1. The user has no activities in this date range`);
            console.log(`  2. The API key doesn't have access to this user's activities`);
            console.log(`  3. The userId mapping is incorrect`);
          } else if (activities.length === 0 && activitiesBeforeFilter === 0) {
            console.log(`No activities returned from API for this date range`);
          }
        }

        console.log(`Fetched ${activities.length} activities from Timebuzzer (totalCount: ${responseData.totalCount || 'N/A'})`);

        if (!Array.isArray(activities)) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid response from Timebuzzer API - activities is not an array",
              responseStructure: Object.keys(responseData),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Fetch users and tiles to get names (same as test-api)
        let usersMap = new Map<number, { firstName: string; lastName: string; email: string }>();
        let tilesMap = new Map<number, string>();
        
        try {
          // Fetch account info to get users
          console.log('Fetching account info to get user names...');
          const accountResponse = await fetch("https://my.timebuzzer.com/open-api/account", {
            headers: {
              Authorization: `APIKey ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
          });
          
          if (accountResponse.ok) {
            const accountData = await accountResponse.json();
            if (accountData.users && Array.isArray(accountData.users)) {
              accountData.users.forEach((user: any) => {
                usersMap.set(user.id, {
                  firstName: user.firstName || '',
                  lastName: user.lastName || '',
                  email: user.email || '',
                });
              });
              console.log(`Fetched ${usersMap.size} users from account endpoint`);
            }
          }
        } catch (e) {
          console.error('Error fetching account info:', e);
        }
        
        try {
          // Fetch tiles to get project names
          console.log('Fetching tiles to get project names...');
          const tilesResponse = await fetch("https://my.timebuzzer.com/open-api/tiles", {
            headers: {
              Authorization: `APIKey ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
          });
          
          if (tilesResponse.ok) {
            const tilesData = await tilesResponse.json();
            if (Array.isArray(tilesData)) {
              tilesData.forEach((tile: any) => {
                tilesMap.set(tile.id, tile.name || `Tile ${tile.id}`);
              });
            } else if (tilesData.items && Array.isArray(tilesData.items)) {
              tilesData.items.forEach((tile: any) => {
                tilesMap.set(tile.id, tile.name || `Tile ${tile.id}`);
              });
            }
            console.log(`Fetched ${tilesMap.size} tiles from tiles endpoint`);
          }
        } catch (e) {
          console.error('Error fetching tiles:', e);
        }
        
        // Get available user IDs from the original API response (before filtering)
        // This helps debug when a specific user has no activities
        const availableUserIds = requestedUserId && action === "fetch-activities" && activities.length === 0
          ? [...new Set((responseData.activities || []).map((a: any) => a.userId))]
          : undefined;

        // Enrich activities with user and tile names
        const enrichedActivities = activities.map((activity: any) => {
          const user = usersMap.get(activity.userId);
          const tileNames = activity.tiles
            ? activity.tiles.map((tileId: number) => tilesMap.get(tileId) || `Tile ${tileId}`)
            : [];
          
          return {
            ...activity,
            userName: user ? `${user.firstName} ${user.lastName}`.trim() || user.email : `User ${activity.userId}`,
            userEmail: user?.email || '',
            tileNames: tileNames,
          };
        });

        return new Response(
          JSON.stringify({
            success: true,
            activities: enrichedActivities,
            count: activities.length,
            totalCount: responseData.totalCount,
            totalDuration: responseData.totalDuration,
            availableUserIds: availableUserIds, // Include available user IDs if filtering resulted in 0 activities
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
            error: `Failed to fetch activities: ${error.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (action === "sync-to-timesheet") {
      // Sync activities to timesheet
      const { startDate, endDate } = body;

      if (!startDate || !endDate) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "startDate and endDate are required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Syncing activities from ${startDate} to ${endDate}`);

      try {
        // Use the filtered activities endpoint from Timebuzzer API documentation
        // POST https://my.timebuzzer.com/open-api/activities/filters
        const filterBody = {
          startDate: `${startDate}T00:00:00.000`,
          endDate: `${endDate}T23:59:59.999`,
          strictDate: true,
        };
        
        console.log(`Calling Timebuzzer API with filter:`, JSON.stringify(filterBody, null, 2));
        
        const response = await fetch(
          "https://my.timebuzzer.com/open-api/activities/filters?offset=0&count=1000",
          {
            method: "POST",
            headers: {
              Authorization: `APIKey ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(filterBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Timebuzzer API error: ${errorText}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API error: ${response.status}`,
              details: errorText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check if response is JSON before parsing
        const responseText = await response.text();
        
        // Check if response is HTML (error page)
        if (responseText.trim().toLowerCase().startsWith('<!doctype') || 
            responseText.trim().toLowerCase().startsWith('<html')) {
          console.error('Timebuzzer API returned HTML instead of JSON');
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API returned an HTML error page. Status: ${response.status}`,
              details: responseText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Try to parse as JSON
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError: any) {
          console.error('Failed to parse JSON response:', parseError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API returned invalid JSON. Response starts with: ${responseText.substring(0, 100)}`,
              details: responseText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // The filtered activities endpoint returns {totalCount, totalDuration, activities: [...]}
        const activities: TimebuzzerActivity[] = responseData.activities || (Array.isArray(responseData) ? responseData : []);

        console.log(`Fetched ${activities.length} activities from Timebuzzer (totalCount: ${responseData.totalCount || 'N/A'})`);

        if (!Array.isArray(activities)) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid response from Timebuzzer API - activities is not an array",
              responseStructure: Object.keys(responseData),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Get user mappings (Timebuzzer user ID -> local user ID)
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, timebuzzer_user_id, email");

        if (usersError) {
          console.error("Error fetching users:", usersError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to fetch users: ${usersError.message}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Create user map: Timebuzzer user ID (number as string) -> local user ID
        const userMap = new Map<string, string>();
        (users || []).forEach((user) => {
          if (user.timebuzzer_user_id) {
            // Store as string for consistent lookup (API returns numbers, but we store as string)
            userMap.set(String(user.timebuzzer_user_id), user.id);
          }
        });

        console.log(`Found ${userMap.size} users with Timebuzzer mappings`);

        // Get project mappings (Timebuzzer tile ID -> local project id and name)
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, timebuzzer_project_id");

        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to fetch projects: ${projectsError.message}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Create project maps: Timebuzzer tile ID (number as string) -> local project id and name
        const projectIdMap = new Map<string, number>();
        const projectNameMap = new Map<string, string>();
        (projects || []).forEach((project) => {
          if (project.timebuzzer_project_id) {
            // Store as string for consistent lookup (API returns numbers, but we store as string)
            const tileId = String(project.timebuzzer_project_id);
            projectIdMap.set(tileId, project.id);
            projectNameMap.set(tileId, project.name);
          }
        });

        console.log(`Found ${projectIdMap.size} projects with Timebuzzer mappings`);

        // Process activities and insert into timesheet
        let inserted = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const activity of activities) {
          try {
            // Find local user ID (API uses userId, not user_id)
            const timebuzzerUserId = String(activity.userId);
            const localUserId = userMap.get(timebuzzerUserId);
            if (!localUserId) {
              console.log(
                `Skipping activity ${activity.id}: No local user found for Timebuzzer user ${activity.userId}`
              );
              skipped++;
              continue;
            }

            // Find local project name (API uses tiles array, take first tile)
            if (!activity.tiles || activity.tiles.length === 0) {
              console.log(
                `Skipping activity ${activity.id}: No tiles in activity`
              );
              skipped++;
              continue;
            }
            
            // Use the first tile (or you could process all tiles separately)
            const firstTileId = String(activity.tiles[0]);
            const localProjectId = projectIdMap.get(firstTileId);
            const localProjectName = projectNameMap.get(firstTileId);
            if (!localProjectId || !localProjectName) {
              console.log(
                `Skipping activity ${activity.id}: No local project found for Timebuzzer tile ${firstTileId}`
              );
              skipped++;
              continue;
            }

            // Calculate hours from startDate and endDate (API uses startDate/endDate, not start_time/end_time)
            let hours = 0;
            if (activity.startDate && activity.endDate) {
              // Calculate from start and end dates
              const start = new Date(activity.startDate);
              const end = new Date(activity.endDate);
              hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            } else {
              console.log(
                `Skipping activity ${activity.id}: No startDate or endDate`
              );
              skipped++;
              continue;
            }

            // Round to 2 decimal places
            hours = Math.round(hours * 100) / 100;

            // Parse date from startDate (API uses startDate, not start_time)
            const activityDate = new Date(activity.startDate);
            const dateStr = activityDate.toISOString().split("T")[0];

            // Insert or update timesheet entry
            // Note: timesheet table uses 'project' (name) not 'project_id'
            // All Timebuzzer entries automatically get work type 100 (Remote)
            const insertData: any = {
              user_id: localUserId,
              project: localProjectName, // Use project name as the table expects
              date: dateStr,
              hours: hours,
              description: "100", // All Timebuzzer entries get work type 100 (Remote)
              timebuzzer_activity_id: String(activity.id), // Prevent duplicates (convert to string for consistency)
            };
            
            // First, check if this activity already exists
            const { data: existing, error: checkError } = await supabase
              .from("timesheet")
              .select("id")
              .eq("timebuzzer_activity_id", String(activity.id))
              .limit(1);
            
            let insertError: any = null;
            
            if (checkError) {
              console.error(`Error checking for existing activity ${activity.id}:`, checkError);
            }
            
            if (existing && existing.length > 0) {
              // Update existing entry
              const { error: updateError } = await supabase
                .from("timesheet")
                .update(insertData)
                .eq("timebuzzer_activity_id", String(activity.id));
              
              insertError = updateError;
              if (!updateError) {
                console.log(`Updated existing activity ${activity.id} for user ${localUserId} on ${dateStr}`);
              }
            } else {
              // Insert new entry
              const { error: insertErr } = await supabase
                .from("timesheet")
                .insert(insertData);
              
              insertError = insertErr;
              if (!insertErr) {
                console.log(`Inserted new activity ${activity.id} for user ${localUserId} on ${dateStr}`);
              }
            }

            if (insertError) {
              console.error(
                `Error inserting/updating activity ${activity.id}:`,
                insertError
              );
              console.error(`Insert data was:`, JSON.stringify(insertData, null, 2));
              console.error(`Full error details:`, {
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code,
              });
              errors.push(
                `Activity ${activity.id}: ${insertError.message}${insertError.details ? ` (${insertError.details})` : ''}${insertError.hint ? ` - Hint: ${insertError.hint}` : ''}`
              );
            } else {
              inserted++;
            }
          } catch (error: any) {
            console.error(`Error processing activity ${activity.id}:`, error);
            errors.push(`Activity ${activity.id}: ${error.message}`);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            inserted: inserted,
            skipped: skipped,
            errors: errors.length > 0 ? errors : undefined,
            total: activities.length,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        console.error("Sync error:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to sync: ${error.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (action === "sync-selected-activities") {
      // Sync only selected activities
      const { activities, startDate, endDate } = body;

      if (!activities || !Array.isArray(activities) || activities.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "activities array is required and must not be empty",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Syncing ${activities.length} selected activities`);

      try {
        // Get user mappings (Timebuzzer user ID -> local user ID)
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, timebuzzer_user_id, email");

        if (usersError) {
          console.error("Error fetching users:", usersError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to fetch users: ${usersError.message}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Create user map: Timebuzzer user ID (number as string) -> local user ID
        const userMap = new Map<string, string>();
        (users || []).forEach((user) => {
          if (user.timebuzzer_user_id) {
            userMap.set(String(user.timebuzzer_user_id), user.id);
          }
        });

        console.log(`Found ${userMap.size} users with Timebuzzer mappings`);

        // Get project mappings (Timebuzzer tile ID -> local project id and name)
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, timebuzzer_project_id");

        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to fetch projects: ${projectsError.message}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Create project maps: Timebuzzer tile ID (number as string) -> local project id and name
        const projectIdMap = new Map<string, number>();
        const projectNameMap = new Map<string, string>();
        (projects || []).forEach((project) => {
          if (project.timebuzzer_project_id) {
            const tileId = String(project.timebuzzer_project_id);
            projectIdMap.set(tileId, project.id);
            projectNameMap.set(tileId, project.name);
          }
        });

        console.log(`Found ${projectIdMap.size} projects with Timebuzzer mappings`);

        // Fetch tiles from Timebuzzer to get project names for auto-creation
        let tilesMap = new Map<number, string>();
        try {
          console.log('Fetching tiles from Timebuzzer to get project names...');
          const tilesResponse = await fetch("https://my.timebuzzer.com/open-api/tiles", {
            headers: {
              Authorization: `APIKey ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
          });
          
          if (tilesResponse.ok) {
            const tilesData = await tilesResponse.json();
            const tilesArray = Array.isArray(tilesData) ? tilesData : (tilesData.items || []);
            tilesArray.forEach((tile: any) => {
              tilesMap.set(tile.id, tile.name || `Tile ${tile.id}`);
            });
            console.log(`Fetched ${tilesMap.size} tiles from Timebuzzer`);
          }
        } catch (e) {
          console.error('Error fetching tiles:', e);
        }

        // Process selected activities: first collect all valid activities, then group by (user, date, project) and combine
        let skipped = 0;
        let projectsCreated = 0;
        const errors: string[] = [];
        const skipReasons: { activityId: number; reason: string }[] = [];
        
        // First pass: collect all valid activities with their processed data
        interface ProcessedActivity {
          activity: any;
          localUserId: string;
          localProjectName: string;
          localProjectId: number;
          dateStr: string;
          hours: number;
          startTime: string;
          endTime: string;
          startDateTime: Date;
          endDateTime: Date;
        }
        
        const processedActivities: ProcessedActivity[] = [];

        for (const activity of activities) {
          try {
            // Find local user ID
            const timebuzzerUserId = String(activity.userId);
            const localUserId = userMap.get(timebuzzerUserId);
            if (!localUserId) {
              const reason = `No local user found for Timebuzzer user ${activity.userId}. Please map this user in the database.`;
              console.log(`Skipping activity ${activity.id}: ${reason}`);
              skipReasons.push({ activityId: activity.id, reason });
              skipped++;
              continue;
            }

            // Find local project name
            if (!activity.tiles || activity.tiles.length === 0) {
              const reason = `No tiles (projects) in activity`;
              console.log(`Skipping activity ${activity.id}: ${reason}`);
              skipReasons.push({ activityId: activity.id, reason });
              skipped++;
              continue;
            }

            // Use the LAST tile (most specific project), not the first (client)
            // Timebuzzer tiles array represents hierarchy: [client, project, subproject]
            // We want the most specific one (last in array)
            const tileIndex = activity.tiles.length - 1;
            const projectTileId = String(activity.tiles[tileIndex]);
            let localProjectId = projectIdMap.get(projectTileId);
            let localProjectName = projectNameMap.get(projectTileId);
            
            // If project doesn't exist, create it automatically with Timebuzzer name
            if (!localProjectId || !localProjectName) {
              const timebuzzerProjectName = tilesMap.get(Number(projectTileId)) || `Timebuzzer Project ${projectTileId}`;
              
              console.log(`Project not found for tile ${projectTileId}, creating new project: ${timebuzzerProjectName}`);
              
              // Check if project with this name already exists (without mapping)
              const { data: existingProject } = await supabase
                .from("projects")
                .select("id, name")
                .eq("name", timebuzzerProjectName)
                .limit(1)
                .single();
              
              if (existingProject) {
                // Update existing project with Timebuzzer ID
                const { error: updateError } = await supabase
                  .from("projects")
                  .update({ timebuzzer_project_id: projectTileId })
                  .eq("id", existingProject.id);
                
                if (updateError) {
                  console.error(`Error updating project ${existingProject.id}:`, updateError);
                  const reason = `Failed to update existing project: ${updateError.message}`;
                  skipReasons.push({ activityId: activity.id, reason });
                  skipped++;
                  continue;
                }
                
                localProjectId = existingProject.id;
                localProjectName = existingProject.name;
                console.log(`Updated existing project ${existingProject.name} with Timebuzzer ID ${projectTileId}`);
              } else {
                // Create new project
                const { data: newProject, error: createError } = await supabase
                  .from("projects")
                  .insert({
                    name: timebuzzerProjectName,
                    timebuzzer_project_id: projectTileId,
                    status: "active",
                  })
                  .select("id, name")
                  .single();
                
                if (createError || !newProject) {
                  console.error(`Error creating project:`, createError);
                  const reason = `Failed to create project: ${createError?.message || 'Unknown error'}`;
                  skipReasons.push({ activityId: activity.id, reason });
                  skipped++;
                  continue;
                }
                
                localProjectId = newProject.id;
                localProjectName = newProject.name;
                projectsCreated++;
                
                // Update maps for subsequent activities
                projectIdMap.set(projectTileId, newProject.id);
                projectNameMap.set(projectTileId, newProject.name);
                
                console.log(`Created new project: ${newProject.name} (ID: ${newProject.id}) with Timebuzzer ID ${projectTileId}`);
              }
            }

            // Calculate hours
            let hours = 0;
            if (activity.startDate && activity.endDate) {
              const start = new Date(activity.startDate);
              const end = new Date(activity.endDate);
              hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            } else {
              console.log(`Skipping activity ${activity.id}: No startDate or endDate`);
              skipped++;
              continue;
            }

            hours = Math.round(hours * 100) / 100;

            // Parse date from startDate
            const activityDate = new Date(activity.startDate);
            const dateStr = activityDate.toISOString().split("T")[0];
            
            // Extract time from startDate and endDate (format: HH:mm)
            // Timebuzzer returns dates in UTC, but we want local time for display
            // The Edge Function runs in UTC, so we need to convert to local time (CET/CEST = UTC+1 or UTC+2)
            // Use the UTC offset from the activity if available, otherwise assume UTC+1 (CET)
            const startDateTime = new Date(activity.startDate);
            const endDateTime = new Date(activity.endDate);
            
            // Calculate UTC offset in hours (default to +1 for CET, +2 for CEST)
            // Timebuzzer offset format: "+01:00" or "+02:00" or "-05:00" etc.
            let utcOffsetHours = 1; // Default to CET (UTC+1)
            if (activity.startUtcOffset) {
              // Parse offset like "+01:00" or "+02:00"
              const offsetMatch = activity.startUtcOffset.match(/([+-])(\d{2}):(\d{2})/);
              if (offsetMatch) {
                const sign = offsetMatch[1] === '+' ? 1 : -1;
                const hours = parseInt(offsetMatch[2], 10);
                const minutes = parseInt(offsetMatch[3], 10);
                utcOffsetHours = sign * (hours + minutes / 60);
              }
            }
            
            // Convert UTC time to local time by adding the offset
            const startLocalTime = new Date(startDateTime.getTime() + (utcOffsetHours * 60 * 60 * 1000));
            const endLocalTime = new Date(endDateTime.getTime() + (utcOffsetHours * 60 * 60 * 1000));
            
            // Format as HH:mm (using UTC methods since we already applied the offset)
            const startTime = `${String(startLocalTime.getUTCHours()).padStart(2, '0')}:${String(startLocalTime.getUTCMinutes()).padStart(2, '0')}`;
            const endTime = `${String(endLocalTime.getUTCHours()).padStart(2, '0')}:${String(endLocalTime.getUTCMinutes()).padStart(2, '0')}`;
            
            console.log(`Activity ${activity.id}: ${dateStr} ${startTime} - ${endTime} (${hours} hours)`);

            // Collect the processed activity for later combining
            // Only add if we have all required fields
            if (localUserId && localProjectName && localProjectId) {
              processedActivities.push({
                activity,
                localUserId,
                localProjectName,
                localProjectId,
                dateStr,
                hours,
                startTime,
                endTime,
                startDateTime: startLocalTime,
                endDateTime: endLocalTime,
              });
            }
          } catch (error: any) {
            console.error(`Error processing activity ${activity.id}:`, error);
            errors.push(`Activity ${activity.id}: ${error.message}`);
          }
        }

        // Second pass: group activities by (user, date, project) and combine only consecutive ones
        // First, sort all activities by start time
        processedActivities.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
        
        // Group by (user, date, project) and then split into consecutive groups
        // Key format: "userId|date|projectName"
        const groupedActivities = new Map<string, ProcessedActivity[]>();
        
        // First, group by key
        const tempGroups = new Map<string, ProcessedActivity[]>();
        for (const processed of processedActivities) {
          const key = `${processed.localUserId}|${processed.dateStr}|${processed.localProjectName}`;
          if (!tempGroups.has(key)) {
            tempGroups.set(key, []);
          }
          tempGroups.get(key)!.push(processed);
        }
        
        // Then, for each group, split into consecutive sub-groups
        // Activities are consecutive if the end time of one is close to the start time of the next (within 1 minute)
        for (const [key, group] of tempGroups.entries()) {
          // Sort by start time (should already be sorted, but just to be sure)
          group.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
          
          // Split into consecutive sub-groups
          const consecutiveGroups: ProcessedActivity[][] = [];
          let currentGroup: ProcessedActivity[] = [];
          
          for (let i = 0; i < group.length; i++) {
            const current = group[i];
            
            if (currentGroup.length === 0) {
              // Start a new group
              currentGroup = [current];
            } else {
              // Check if this activity is consecutive to the last one in current group
              const lastInGroup = currentGroup[currentGroup.length - 1];
              const timeGap = current.startDateTime.getTime() - lastInGroup.endDateTime.getTime();
              const gapMinutes = timeGap / (1000 * 60);
              
              // If gap is less than 30 minutes, consider it consecutive
              // This allows combining entries that are close together (e.g., 08:42 and 08:50 = 8 min gap)
              if (gapMinutes <= 30) {
                currentGroup.push(current);
              } else {
                // Save current group and start a new one
                consecutiveGroups.push(currentGroup);
                currentGroup = [current];
              }
            }
          }
          
          // Don't forget the last group
          if (currentGroup.length > 0) {
            consecutiveGroups.push(currentGroup);
          }
          
          // Add each consecutive group as a separate entry
          consecutiveGroups.forEach((subGroup, index) => {
            const groupKey = index === 0 ? key : `${key}_${index}`;
            groupedActivities.set(groupKey, subGroup);
          });
        }
        
        console.log(`Grouped ${processedActivities.length} activities into ${groupedActivities.size} combined entries (only consecutive activities are combined)`);
        
        // Third pass: combine activities in each group and insert
        let inserted = 0;
        for (const [key, group] of groupedActivities.entries()) {
          try {
            // Sort by start time (should already be sorted)
            group.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
            
            // Get first start time and last end time
            const firstActivity = group[0];
            const lastActivity = group[group.length - 1];
            
            // Calculate total hours
            const totalHours = group.reduce((sum, a) => sum + a.hours, 0);
            const roundedHours = Math.round(totalHours * 100) / 100;
            
            // Use startTime from first activity and endTime from last activity
            const combinedStartTime = firstActivity.startTime;
            const combinedEndTime = lastActivity.endTime;
            
            // Combine notes (if any)
            const combinedNotes = group
              .map(a => a.activity.note)
              .filter(note => note && note.trim())
              .join('; ');
            
            // Create combined entry
            // All Timebuzzer entries automatically get work type 100 (Remote)
            const insertData: any = {
              user_id: firstActivity.localUserId,
              project: firstActivity.localProjectName || "",
              date: firstActivity.dateStr,
              hours: roundedHours,
              description: "100", // All Timebuzzer entries get work type 100 (Remote)
              startTime: combinedStartTime,
              endTime: combinedEndTime,
              // Store all activity IDs in a comma-separated string for reference
              timebuzzer_activity_id: group.map(a => String(a.activity.id)).join(','),
            };
            
            // Check if any of these activities already exist
            const activityIds = group.map(a => String(a.activity.id));
            const { data: existing, error: checkError } = await supabase
              .from("timesheet")
              .select("id, timebuzzer_activity_id")
              .in("timebuzzer_activity_id", activityIds)
              .limit(1);
            
            let insertError: any = null;
            
            if (checkError) {
              console.error(`Error checking for existing activities:`, checkError);
            }
            
            if (existing && existing.length > 0) {
              // Update existing entry (use the first found entry's ID)
              const { error: updateError } = await supabase
                .from("timesheet")
                .update(insertData)
                .eq("id", existing[0].id);
              
              insertError = updateError;
              if (!updateError) {
                console.log(`Updated combined entry for user ${firstActivity.localUserId} on ${firstActivity.dateStr} (${group.length} activities combined)`);
              }
            } else {
              // Insert new combined entry
              const { error: insertErr } = await supabase.from("timesheet").insert(insertData);
              
              insertError = insertErr;
              if (!insertErr) {
                console.log(`Inserted combined entry for user ${firstActivity.localUserId} on ${firstActivity.dateStr} (${group.length} activities combined: ${combinedStartTime} - ${combinedEndTime}, ${roundedHours} hours)`);
              }
            }
            
            if (insertError) {
              console.error(`Error inserting/updating combined entry for key ${key}:`, insertError);
              errors.push(`Combined entry (${group.length} activities): ${insertError.message}`);
            } else {
              inserted++;
            }
          } catch (error: any) {
            console.error(`Error combining activities for key ${key}:`, error);
            errors.push(`Combined entry error: ${error.message}`);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            inserted: inserted,
            skipped: skipped,
            projectsCreated: projectsCreated,
            errors: errors.length > 0 ? errors : undefined,
            skipReasons: skipReasons.length > 0 ? skipReasons : undefined,
            total: activities.length,
            userMappingsFound: userMap.size,
            projectMappingsFound: projectIdMap.size,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        console.error("Sync selected activities error:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to sync selected activities: ${error.message}`,
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
        error: `Unknown action: ${action}. Supported actions: test-api, fetch-activities, sync-to-timesheet, sync-selected-activities`,
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
