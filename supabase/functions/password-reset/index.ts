// Supabase Edge Function: password-reset
// Sends a password reset email via Supabase's built-in email service
//
// To deploy:
// 1) Go to Supabase Dashboard → Edge Functions
// 2) Click "Create a new function"
// 3) Name it: password-reset
// 4) Copy this code and paste it
// 5) Click "Deploy"
//
// Note: Supabase automatically provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type PasswordResetPayload = {
  email: string;
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
    const { email } = (await req.json()) as PasswordResetPayload;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
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

    // Create admin client for user management
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";
    
    console.log("Password reset request for:", email);
    
    // First check if user exists in our custom users table
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (userError || !user) {
      console.log("User not found in users table:", userError);
      return new Response(JSON.stringify({ 
        error: "User not found",
        message: "Gebruiker niet gevonden. Controleer je email adres."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }
    
    console.log("User found in users table:", user.email);

    // Check if user exists in Supabase Auth
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      return new Response(JSON.stringify({ 
        error: "Failed to check auth users",
        message: listError.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const authUser = authUsers.users.find(u => u.email === email);

    if (!authUser) {
      console.log("User not in Auth, creating user...");
      // User doesn't exist in Auth - create them first
      // Generate a temporary password (user will reset it via email link)
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + "A1!";
      
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
      });

      if (createError || !newAuthUser.user) {
        console.error("Failed to create auth user:", createError);
        return new Response(JSON.stringify({ 
          error: "Failed to create auth user",
          message: createError?.message || "Could not create user in Supabase Auth"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      console.log("Auth user created, generating reset link...");
      // Generate password reset link using admin API
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: email,
        options: {
          redirectTo: `${appUrl}/reset`,
        },
      });

      if (resetError || !resetData) {
        console.error("Failed to generate reset link:", resetError);
        return new Response(JSON.stringify({ 
          error: "Failed to generate reset link",
          message: resetError?.message || "Could not generate password reset link"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      console.log("Reset link generated, email should be sent automatically");
      // The email is automatically sent via Supabase's email service when using generateLink
      return new Response(JSON.stringify({ 
        success: true,
        message: "Password reset email sent successfully. Check your inbox (and spam folder)."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log("User exists in Auth, generating reset link...");
    // User exists in Auth - generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${appUrl}/reset`,
      },
    });

    if (resetError || !resetData) {
      console.error("Failed to generate reset link:", resetError);
      return new Response(JSON.stringify({ 
        error: "Failed to generate reset link",
        message: resetError?.message || "Could not generate password reset link"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log("Reset link generated, email should be sent automatically");
    // The email is automatically sent via Supabase's email service when using generateLink
    return new Response(JSON.stringify({ 
      success: true,
      message: "Password reset email sent successfully. Check your inbox (and spam folder)."
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

