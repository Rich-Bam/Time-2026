// Supabase Edge Function: invite-user
// Sends an invite email via Supabase Auth and creates a matching row
// in the public.users table with admin flags.
//
// To deploy:
// 1) Install Supabase CLI
// 2) Set env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the function
// 3) Run: supabase functions deploy invite-user --project-ref bgddtkiekjcdhcmrnxsi
// 4) In the frontend, call: POST {SUPABASE_URL}/functions/v1/invite-user

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Send invite email via Supabase Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name, isAdmin },
    });

    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError?.message || "Failed to invite user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 2) Create a matching row in public.users
    const { error: dbError } = await supabase.from("users").insert({
      id: user.id, // keep same ID as auth user
      email,
      name,
      password: "", // password is handled by Supabase Auth invite flow
      isAdmin,
      must_change_password: true,
    });

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ success: true, userId: user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});


