// Supabase Edge Function: update-password
// Updates password in custom users table after password reset
// This bypasses RLS policies by using service_role
//
// To deploy:
// 1) Go to Supabase Dashboard → Edge Functions
// 2) Click "Create a new function"
// 3) Name it: update-password
// 4) Copy this code and paste it
// 5) Click "Deploy"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type UpdatePasswordPayload = {
  email: string;
  password: string; // Hashed password
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-supabase-api-version, accept, accept-language, if-modified-since, if-none-match, x-requested-with",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = (await req.json()) as UpdatePasswordPayload;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
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

    // Create admin client with service_role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("Updating password for user:", email);
    
    // Update password in users table using service_role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ 
        password: password, // Hashed password
        must_change_password: false 
      })
      .eq("email", email);

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return new Response(JSON.stringify({ 
        error: "Failed to update password",
        message: updateError.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log("✅ Password updated successfully in users table");
    return new Response(JSON.stringify({ 
      success: true,
      message: "Password updated successfully"
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


