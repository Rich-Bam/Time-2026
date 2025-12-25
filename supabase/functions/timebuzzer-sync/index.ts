// Timebuzzer Sync Edge Function
// This function syncs time entries from Timebuzzer API to the local timesheet
// Also supports fetching users and activities

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TimebuzzerUser {
  id: number;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the API key from environment variables
    const apiKey = Deno.env.get("TIMEBUZZER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "TIMEBUZZER_API_KEY environment variable is not set",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { action } = await req.json();

    // Handle fetch-users action
    if (action === "fetch-users") {
      try {
        // Timebuzzer API endpoint for users
        // Note: Check Timebuzzer API documentation for the correct endpoint
        const endpoint = "https://my.timebuzzer.com/open-api/users";
        
        console.log(`Fetching users from: ${endpoint}`);
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
        console.log(`Response preview: ${responseText.substring(0, 500)}`);

        // Check if response is HTML (error page)
        if (
          responseText.trim().toLowerCase().startsWith("<!doctype") ||
          responseText.trim().toLowerCase().startsWith("<html")
        ) {
          console.error("Timebuzzer API returned HTML instead of JSON");
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API returned HTML instead of JSON. Status: ${response.status}. This usually means the API key is invalid or expired, or the endpoint doesn't exist.`,
              details: responseText.substring(0, 500),
              suggestion:
                "Please check: 1) Verify the API key is correct in Timebuzzer Settings → API 2) Check Timebuzzer API documentation for the correct users endpoint 3) Generate a new API key if the current one might be expired",
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
        } catch (parseError) {
          console.error("Failed to parse JSON:", parseError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to parse JSON response: ${parseError}`,
              responsePreview: responseText.substring(0, 500),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Handle different response formats
        let users: TimebuzzerUser[] = [];
        
        if (Array.isArray(data)) {
          // Response is directly an array of users
          users = data;
        } else if (data.users && Array.isArray(data.users)) {
          // Response has users in a users property
          users = data.users;
        } else if (data.data && Array.isArray(data.data)) {
          // Response has users in a data property
          users = data.data;
        } else if (data.results && Array.isArray(data.results)) {
          // Response has users in a results property
          users = data.results;
        } else {
          // Try to find any array in the response
          const keys = Object.keys(data);
          for (const key of keys) {
            if (Array.isArray(data[key])) {
              users = data[key];
              break;
            }
          }
        }

        // Normalize user data
        const normalizedUsers = users.map((user: any) => ({
          id: user.id || user.userId || user.user_id,
          email: user.email || user.emailAddress || user.email_address,
          name: user.name || 
                (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) ||
                (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : null) ||
                user.displayName ||
                user.display_name,
        })).filter((user: any) => user.id); // Filter out users without ID

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

    // For other actions (fetch-activities, sync-to-timesheet, etc.)
    // Return a message that these need to be implemented
    return new Response(
      JSON.stringify({
        success: false,
        error: `Action "${action}" is not yet implemented. Only "fetch-users" is currently supported.`,
        availableActions: ["fetch-users"],
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});



