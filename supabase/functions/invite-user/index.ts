// Supabase Edge Function: invite-user
// Sends an invite email via Resend and creates a user in the public.users table
//
// To deploy:
// 1) Install Supabase CLI
// 2) Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
// 3) Run: supabase functions deploy invite-user --project-ref bgddtkiekjcdhcmrnxsi
// 4) In the frontend, call: POST {SUPABASE_URL}/functions/v1/invite-user
//
// Environment variables needed:
// - SUPABASE_URL: Your Supabase project URL
// - SUPABASE_SERVICE_ROLE_KEY: Your service_role key
// - RESEND_API_KEY: Your Resend API key (get from https://resend.com/api-keys)
// - RESEND_FROM_EMAIL: Email address to send from (e.g., "noreply@bampro.nl")

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type InvitePayload = {
  email: string;
  name: string;
  isAdmin?: boolean;
  password?: string; // Optional temporary password
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
    const { email, name, isAdmin = false, password } = (await req.json()) as InvitePayload;

    if (!email || !name) {
      return new Response(JSON.stringify({ error: "Email and name are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@bampro.nl";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY. Please configure Resend in Edge Function secrets." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate a temporary password if not provided
    const tempPassword = password || Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + "A1!";

    // Create user in public.users table first
    const { data: newUser, error: dbError } = await supabase
      .from("users")
      .insert({
        email,
        name,
        password: tempPassword,
        isAdmin,
        must_change_password: true,
        approved: true, // Admins creating users are auto-approved
      })
      .select()
      .single();

    if (dbError) {
      return new Response(JSON.stringify({ error: `Failed to create user: ${dbError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create login URL (you'll need to adjust this to your actual domain)
    const loginUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";
    
    // Send invite email via Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f97316; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 5px; margin-top: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #f97316; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .credentials { background-color: #fff; padding: 15px; border-left: 4px solid #f97316; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welkom bij BAMPRO MARINE</h1>
            </div>
            <div class="content">
              <p>Hallo ${name},</p>
              <p>Je bent uitgenodigd om gebruik te maken van het BAMPRO MARINE timesheet systeem.</p>
              
              <div class="credentials">
                <p><strong>Je inloggegevens:</strong></p>
                <p>Email: <strong>${email}</strong></p>
                <p>Tijdelijk wachtwoord: <strong>${tempPassword}</strong></p>
              </div>
              
              <p>Je wordt gevraagd om je wachtwoord te wijzigen bij de eerste login.</p>
              
              <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Inloggen</a>
              </p>
              
              <p>Als je vragen hebt, neem dan contact op met je beheerder.</p>
            </div>
            <div class="footer">
              <p>BAMPRO MARINE - Timesheet Systeem</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: "Uitnodiging voor BAMPRO MARINE Timesheet",
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}));
      console.error("Resend API error:", errorData);
      
      // User is already created, so we return success but log the email error
      return new Response(JSON.stringify({ 
        success: true, 
        userId: newUser.id,
        warning: "User created but email failed to send. Check Resend configuration." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: newUser.id,
      message: "User created and invitation email sent successfully" 
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


