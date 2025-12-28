// Supabase Edge Function: invite-user
// Sends an invite email via Resend and creates a user
//
// To deploy:
// 1) Set up Resend API key in Supabase Dashboard → Edge Functions → Secrets
// 2) Add secret: RESEND_API_KEY (your Resend API key)
// 3) Add secret: RESEND_FROM_EMAIL (verified email in Resend, e.g., support@bampro-uren.nl)
// 4) Deploy via Dashboard or CLI: supabase functions deploy invite-user --project-ref bgddtkiekjcdhcmrnxsi
//
// Required secrets:
// - RESEND_API_KEY: Your Resend API key
// - RESEND_FROM_EMAIL: Verified sender email address in Resend (e.g., support@bampro-uren.nl)
// - APP_URL (optional): Your app URL, defaults to https://bampro-uren.nl

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type InvitePayload = {
  email: string;
  name: string;
  isAdmin?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-supabase-api-version, accept, accept-language, if-modified-since, if-none-match, x-requested-with",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, isAdmin = false } = (await req.json()) as InvitePayload;

    if (!email || !name) {
      return new Response(JSON.stringify({ error: "Email and name are required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";

    // Check if user already exists in auth
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
    
    let user;
    let inviteLink;

    if (existingUser?.user) {
      // User already exists in auth - generate a new invite link
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "invite",
        email: email,
        options: {
          redirectTo: `${appUrl}/invite-confirm`,
        },
      });

      if (linkError || !linkData) {
        return new Response(JSON.stringify({ 
          error: "Failed to generate invite link",
          details: linkError?.message || "Could not generate invitation link"
        }), {
          headers: corsHeaders,
          status: 400,
        });
      }

      user = existingUser.user;
      inviteLink = linkData.properties.action_link;
    } else {
      // Create new user in Supabase Auth
      const {
        data: { user: newUser },
        error: authError,
      } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { 
          name, 
          isAdmin: isAdmin ? "true" : "false"
        },
        redirectTo: `${appUrl}/invite-confirm`,
      });

      if (authError || !newUser) {
        return new Response(JSON.stringify({ 
          error: authError?.message || "Failed to invite user",
          details: "Could not create user in Supabase Auth"
        }), {
          headers: corsHeaders,
          status: 400,
        });
      }

      user = newUser;
      
      // Get the invite link from the response
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "invite",
        email: email,
        options: {
          redirectTo: `${appUrl}/invite-confirm`,
        },
      });

      if (linkError || !linkData) {
        return new Response(JSON.stringify({ 
          error: "Failed to generate invite link",
          details: linkError?.message || "Could not generate invitation link"
        }), {
          headers: corsHeaders,
          status: 400,
        });
      }

      inviteLink = linkData.properties.action_link;
    }

    // Create matching row in public.users table using service_role (bypasses RLS)
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + "A1!";
    
    const { error: dbError } = await supabase.from("users").insert({
      id: user.id,
      email,
      name,
      password: tempPassword,
      isAdmin,
      must_change_password: true,
      approved: true,
    });

    if (dbError) {
      // If user already exists in users table, try update
      if (dbError.code === "23505") { // Unique constraint violation
        const { error: updateError } = await supabase
          .from("users")
          .update({ name, isAdmin, approved: true, must_change_password: true })
          .eq("id", user.id);
        
        if (updateError) {
          return new Response(JSON.stringify({ error: `Failed to create/update user: ${dbError.message}` }), {
            headers: corsHeaders,
            status: 400,
          });
        }
      } else {
        return new Response(JSON.stringify({ error: `Failed to create user: ${dbError.message}` }), {
          headers: corsHeaders,
          status: 400,
        });
      }
    }

    // Send invite email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "support@bampro-uren.nl";

    if (!resendApiKey) {
      return new Response(JSON.stringify({ 
        error: "RESEND_API_KEY secret is not configured",
        details: "Please add RESEND_API_KEY secret in Supabase Dashboard → Edge Functions → Secrets"
      }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    // Email HTML template with beautiful layout
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BAMPRO MARINE</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ea580c; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 1px;">BAMPRO MARINE</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Timesheet System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 600;">Welcome, ${name}!</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                You have been invited to join the BAMPRO MARINE Timesheet System. We're excited to have you on board!
              </p>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">Your Account Details:</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px;">
                  <strong>Email:</strong> ${email}<br>
                  <strong>Role:</strong> ${isAdmin ? "Administrator" : "User"}
                </p>
              </div>
              
              <p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                To get started, please click the button below to set up your password and activate your account.
              </p>
              
              <div style="margin: 30px 0; text-align: center;">
                <a href="${inviteLink}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(234, 88, 12, 0.3);">Activate Your Account</a>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong>Important:</strong> This invitation link will expire in 7 days. If you have any questions or need assistance, please contact your administrator.
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">What's next?</p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                  <li>Click the activation button above</li>
                  <li>Set a secure password for your account</li>
                  <li>Log in and start tracking your hours</li>
                </ul>
              </div>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: #ea580c; font-size: 12px; word-break: break-all; line-height: 1.6;">
                ${inviteLink}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                This is an automated invitation from BAMPRO MARINE Timesheet System.<br>
                You are receiving this email because you have been invited to join our platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Email text version (for plain text clients)
    const emailText = `
Welcome to BAMPRO MARINE Timesheet System

Hello ${name},

You have been invited to join the BAMPRO MARINE Timesheet System. We're excited to have you on board!

Your Account Details:
Email: ${email}
Role: ${isAdmin ? "Administrator" : "User"}

To get started, please click the link below to set up your password and activate your account:

${inviteLink}

Important: This invitation link will expire in 7 days.

What's next?
1. Click the activation link above
2. Set a secure password for your account
3. Log in and start tracking your hours

If you have any questions or need assistance, please contact your administrator.

---
This is an automated invitation from BAMPRO MARINE Timesheet System.
    `.trim();

    // Send email via Resend
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: email,
          subject: `Welcome to BAMPRO MARINE - Activate Your Account`,
          html: emailHtml,
          text: emailText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Resend API error:", result);
        return new Response(JSON.stringify({ 
          error: "Failed to send invitation email",
          details: result.message || result.error || "Resend API returned an error"
        }), {
          headers: corsHeaders,
          status: 500,
        });
      }

      console.log("Invitation email sent successfully via Resend");

      return new Response(JSON.stringify({ 
        success: true, 
        userId: user.id,
        message: "User invited successfully. Invitation email sent via Resend." 
      }), {
        headers: corsHeaders,
        status: 200,
      });
    } catch (emailError) {
      console.error("Error sending email via Resend:", emailError);
      return new Response(JSON.stringify({ 
        error: "Failed to send invitation email",
        details: emailError instanceof Error ? emailError.message : String(emailError)
      }), {
        headers: corsHeaders,
        status: 500,
      });
    }
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
