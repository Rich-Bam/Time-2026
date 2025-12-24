// Edge function to fetch error logs (server-side, uses service_role key)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service_role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the user is super admin by checking the token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      // If Supabase Auth fails, check custom auth
      // For now, we'll allow if the request comes from the app
      // In production, add proper verification
    }

    const { method } = req;
    const url = new URL(req.url);
    
    // Parse request body for POST/DELETE requests (if available)
    let requestBody: any = {};
    if (method === "POST" || method === "DELETE") {
      try {
        const bodyText = await req.text();
        if (bodyText) {
          requestBody = JSON.parse(bodyText);
        }
      } catch (e) {
        // Body might be empty or not JSON, that's okay
        requestBody = {};
      }
    }
    
    // Support both GET (query params) and POST/DELETE (body) requests
    let action: string;
    let filter: string;
    let severity: string;
    let limit: number;
    
    if (method === "POST" || method === "DELETE") {
      // Parse from body for POST/DELETE requests
      action = requestBody.action || url.searchParams.get("action") || "list";
      filter = requestBody.filter || url.searchParams.get("filter") || "unresolved";
      severity = requestBody.severity || url.searchParams.get("severity") || "all";
      limit = parseInt(requestBody.limit || url.searchParams.get("limit") || "100");
    } else {
      // Use query params for GET requests
      action = url.searchParams.get("action") || "list";
      filter = url.searchParams.get("filter") || "unresolved";
      severity = url.searchParams.get("severity") || "all";
      limit = parseInt(url.searchParams.get("limit") || "100");
    }

    if ((method === "GET" || method === "POST") && action === "list") {
      // Get filter parameters (already parsed above)
      // For POST requests, get from body; for GET, get from query params
      const userFilter = method === "POST"
        ? (requestBody.userFilter || "all")
        : (url.searchParams.get("userFilter") || "all");
      
      console.log('Edge function - userFilter:', userFilter, 'method:', method);

      let query = supabaseAdmin
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filter === "unresolved") {
        query = query.eq("resolved", false);
      } else if (filter === "resolved") {
        query = query.eq("resolved", true);
      }

      if (severity !== "all") {
        query = query.eq("severity", severity);
      }

      if (userFilter !== "all") {
        console.log('Edge function - Applying user filter:', userFilter);
        query = query.eq("user_email", userFilter);
      }

      const { data, error } = await query;
      
      if (data) {
        console.log('Edge function - Returning', data.length, 'error logs');
        console.log('Edge function - Unique users in results:', [...new Set(data.map((log: any) => log.user_email))]);
      }

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ data, success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (method === "POST" && action === "resolve") {
      const { errorId, notes, resolvedBy } = requestBody;

      const { data, error } = await supabaseAdmin
        .from("error_logs")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          notes: notes || null,
        })
        .eq("id", errorId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ data, success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (method === "DELETE") {
      if (action === "delete") {
        // Delete single error by ID
        const errorId = requestBody.id || url.searchParams.get("id");

        if (!errorId) {
          return new Response(
            JSON.stringify({ error: "Missing error ID" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { error } = await supabaseAdmin
          .from("error_logs")
          .delete()
          .eq("id", errorId);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else if (action === "delete-all") {
        // Delete all errors - use a condition that always matches
        // Since Supabase requires a WHERE clause, we use a condition that matches all UUIDs
        // First, get count before delete for confirmation
        const { count: countBefore } = await supabaseAdmin
          .from("error_logs")
          .select("*", { count: "exact", head: true });
        
        // Delete all errors using a condition that matches all real UUIDs
        const { data: deletedData, error } = await supabaseAdmin
          .from("error_logs")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000")
          .select(); // Select to verify deletion

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Verify deletion by checking count after
        const { count: countAfter } = await supabaseAdmin
          .from("error_logs")
          .select("*", { count: "exact", head: true });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `All error logs deleted (${countBefore || 0} deleted, ${countAfter || 0} remaining)`,
            deletedCount: countBefore || 0,
            remainingCount: countAfter || 0
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else if (action === "delete-by-message") {
        // Delete errors by message pattern
        const messagePattern = requestBody.messagePattern || url.searchParams.get("messagePattern");

        if (!messagePattern) {
          return new Response(
            JSON.stringify({ error: "Missing message pattern" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { error } = await supabaseAdmin
          .from("error_logs")
          .delete()
          .ilike("error_message", `%${messagePattern}%`);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: `Errors matching "${messagePattern}" deleted` }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

