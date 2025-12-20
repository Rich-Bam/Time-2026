// Timebuzzer Sync Edge Function
// This function syncs time entries from Timebuzzer API to the local timesheet

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TimebuzzerActivity {
  id: string;
  user_id: string;
  tile_id: string;
  start_time: string;
  end_time?: string;
  duration?: number; // in seconds
  description?: string;
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
      // Test API connection - fetch 10 activities
      console.log("Testing Timebuzzer API connection...");
      
      try {
        const response = await fetch(
          "https://my.timebuzzer.com/api/v1/activities?limit=10",
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(`API Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error: ${errorText}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API error: ${response.status} ${response.statusText}`,
              details: errorText,
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const data = await response.json();
        console.log(`API returned ${Array.isArray(data) ? data.length : 'unknown'} items`);

        return new Response(
          JSON.stringify({
            success: true,
            status: "API connection successful",
            data: data,
            count: Array.isArray(data) ? data.length : 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
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
        const response = await fetch(
          `https://my.timebuzzer.com/api/v1/activities?start_date=${startDate}&end_date=${endDate}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API error: ${response.status}`,
              details: errorText,
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const activities = await response.json();

        return new Response(
          JSON.stringify({
            success: true,
            activities: activities,
            count: Array.isArray(activities) ? activities.length : 0,
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
        // Fetch activities from Timebuzzer
        const response = await fetch(
          `https://my.timebuzzer.com/api/v1/activities?start_date=${startDate}&end_date=${endDate}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Timebuzzer API error: ${errorText}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Timebuzzer API error: ${response.status}`,
              details: errorText,
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const activities: TimebuzzerActivity[] = await response.json();
        console.log(`Fetched ${activities.length} activities from Timebuzzer`);

        if (!Array.isArray(activities)) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid response from Timebuzzer API",
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

        const userMap = new Map<string, string>();
        (users || []).forEach((user) => {
          if (user.timebuzzer_user_id) {
            userMap.set(user.timebuzzer_user_id, user.id);
          }
        });

        console.log(`Found ${userMap.size} users with Timebuzzer mappings`);

        // Get project mappings (Timebuzzer tile ID -> local project name)
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("name, timebuzzer_project_id");

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

        const projectMap = new Map<string, string>();
        (projects || []).forEach((project) => {
          if (project.timebuzzer_project_id) {
            projectMap.set(project.timebuzzer_project_id, project.name);
          }
        });

        console.log(`Found ${projectMap.size} projects with Timebuzzer mappings`);

        // Process activities and insert into timesheet
        let inserted = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const activity of activities) {
          try {
            // Find local user ID
            const localUserId = userMap.get(activity.user_id);
            if (!localUserId) {
              console.log(
                `Skipping activity ${activity.id}: No local user found for Timebuzzer user ${activity.user_id}`
              );
              skipped++;
              continue;
            }

            // Find local project name
            const localProjectName = projectMap.get(activity.tile_id);
            if (!localProjectName) {
              console.log(
                `Skipping activity ${activity.id}: No local project found for Timebuzzer tile ${activity.tile_id}`
              );
              skipped++;
              continue;
            }

            // Calculate hours
            let hours = 0;
            if (activity.duration) {
              // Duration is in seconds
              hours = activity.duration / 3600;
            } else if (activity.start_time && activity.end_time) {
              // Calculate from start and end times
              const start = new Date(activity.start_time);
              const end = new Date(activity.end_time);
              hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            } else {
              console.log(
                `Skipping activity ${activity.id}: No duration or end_time`
              );
              skipped++;
              continue;
            }

            // Round to 2 decimal places
            hours = Math.round(hours * 100) / 100;

            // Parse date from start_time
            const activityDate = new Date(activity.start_time);
            const dateStr = activityDate.toISOString().split("T")[0];

            // Insert or update timesheet entry
            const { error: insertError } = await supabase
              .from("timesheet")
              .upsert(
                {
                  user_id: localUserId,
                  project: localProjectName,
                  date: dateStr,
                  hours: hours,
                  description: activity.description || "",
                  timebuzzer_activity_id: activity.id, // Prevent duplicates
                },
                {
                  onConflict: "timebuzzer_activity_id",
                }
              );

            if (insertError) {
              console.error(
                `Error inserting activity ${activity.id}:`,
                insertError
              );
              errors.push(
                `Activity ${activity.id}: ${insertError.message}`
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

    // Unknown action
    return new Response(
      JSON.stringify({
        success: false,
        error: `Unknown action: ${action}. Supported actions: test-api, fetch-activities, sync-to-timesheet`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Function error:", error);
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


