// Supabase Edge Function: send-delete-request-email
// Sends an email to super admin when an administratie user requests to delete a user
//
// To deploy:
// 1) Ensure Resend API key is set in Supabase Dashboard → Edge Functions → Secrets
// 2) Add secret: RESEND_API_KEY (your Resend API key)
// 3) Add secret: RESEND_FROM_EMAIL (verified email in Resend, e.g., support@bampro-uren.nl)
// 4) Deploy via Dashboard or CLI: supabase functions deploy send-delete-request-email --project-ref YOUR_PROJECT_REF
//
// Required secrets:
// - RESEND_API_KEY: Your Resend API key
// - RESEND_FROM_EMAIL: Verified sender email address in Resend
// - APP_URL (optional): Your app URL, defaults to https://bampro-uren.nl

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type DeleteRequestEmailPayload = {
  deleteRequestId: string;
  requestedUserEmail: string;
  requestedUserName: string;
  requestedByEmail: string;
  requestedByName: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-supabase-api-version, accept, accept-language, if-modified-since, if-none-match, x-requested-with",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Log incoming request for debugging
  console.log("Edge Function send-delete-request-email called:", {
    method: req.method,
    url: req.url,
    hasBody: !!req.body,
  });

  try {
    // Parse request body with better error handling
    let payload: DeleteRequestEmailPayload;
    try {
      const body = await req.json();
      console.log("Parsed request body:", body);
      payload = body as DeleteRequestEmailPayload;
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(JSON.stringify({ 
        error: "Invalid request body. Expected JSON.", 
        details: parseError instanceof Error ? parseError.message : String(parseError) 
      }), {
        headers: corsHeaders,
        status: 400,
      });
    }
    
    const { deleteRequestId, requestedUserEmail, requestedUserName, requestedByEmail, requestedByName } = payload;

    if (!deleteRequestId || !requestedUserEmail || !requestedByEmail) {
      return new Response(JSON.stringify({ error: "deleteRequestId, requestedUserEmail, and requestedByEmail are required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get Resend API key and from email from environment
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "support@bampro-uren.nl";
    const appUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";

    if (!resendApiKey) {
      console.error("RESEND_API_KEY secret is not configured");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY secret is not configured" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get super admin email
    const SUPER_ADMIN_EMAIL = "r.blance@bampro.nl";
    const adminPanelUrl = `${appUrl}/#/admin?tab=delete-requests`;

    // Email HTML template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verzoek tot Verwijdering Gebruiker</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ea580c; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Verzoek tot Verwijdering Gebruiker</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Er is een verzoek ingediend om een gebruiker te verwijderen uit het BAMPRO MARINE Timesheet Systeem.
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fef3f2; border-radius: 6px; border-left: 4px solid #ea580c;">
                <p style="margin: 0 0 15px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Gevraagde gebruiker om te verwijderen:</p>
                <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 14px;">
                  <strong>Naam:</strong> ${requestedUserName || requestedUserEmail}
                </p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">
                  <strong>Email:</strong> ${requestedUserEmail}
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 15px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Verzoek ingediend door:</p>
                <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 14px;">
                  <strong>Naam:</strong> ${requestedByName || requestedByEmail}
                </p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">
                  <strong>Email:</strong> ${requestedByEmail}
                </p>
              </div>
              
              <div style="margin: 30px 0; text-align: center;">
                <a href="${adminPanelUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(234, 88, 12, 0.3);">Bekijk Verzoek in Admin Panel</a>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong>Belangrijk:</strong> Log in op het admin panel om dit verzoek te beoordelen en goed te keuren of af te wijzen.
              </p>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Als de knop niet werkt, kopieer en plak deze link in je browser:
              </p>
              <p style="margin: 10px 0 0 0; color: #ea580c; font-size: 12px; word-break: break-all; line-height: 1.6;">
                ${adminPanelUrl}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                Dit is een geautomatiseerde email van het BAMPRO MARINE Timesheet Systeem.<br>
                Je ontvangt deze email omdat er een verzoek is ingediend om een gebruiker te verwijderen.
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
Verzoek tot Verwijdering Gebruiker - BAMPRO MARINE Timesheet Systeem

Er is een verzoek ingediend om een gebruiker te verwijderen uit het BAMPRO MARINE Timesheet Systeem.

Gevraagde gebruiker om te verwijderen:
Naam: ${requestedUserName || requestedUserEmail}
Email: ${requestedUserEmail}

Verzoek ingediend door:
Naam: ${requestedByName || requestedByEmail}
Email: ${requestedByEmail}

Bekijk dit verzoek in het admin panel:
${adminPanelUrl}

Belangrijk: Log in op het admin panel om dit verzoek te beoordelen en goed te keuren of af te wijzen.

---
Dit is een geautomatiseerde email van het BAMPRO MARINE Timesheet Systeem.
Je ontvangt deze email omdat er een verzoek is ingediend om een gebruiker te verwijderen.
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
          to: SUPER_ADMIN_EMAIL,
          subject: `Verzoek tot verwijdering gebruiker - ${requestedUserEmail}`,
          html: emailHtml,
          text: emailText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Resend API error:", result);
        return new Response(JSON.stringify({ 
          error: "Failed to send delete request email",
          details: result.message || result.error || "Resend API returned an error"
        }), {
          headers: corsHeaders,
          status: 500,
        });
      }

      console.log("Delete request email sent successfully via Resend");

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Delete request email sent successfully via Resend." 
      }), {
        headers: corsHeaders,
        status: 200,
      });
    } catch (emailError) {
      console.error("Error sending email via Resend:", emailError);
      return new Response(JSON.stringify({ 
        error: "Failed to send delete request email",
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
