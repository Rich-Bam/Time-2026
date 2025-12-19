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
    // Redirect to /invite-confirm page where user only needs to set password
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { 
        name, 
        isAdmin: isAdmin ? "true" : "false" // Store as string in user metadata
      },
      redirectTo: `${appUrl}/invite-confirm`, // Redirect to invite confirmation page
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


