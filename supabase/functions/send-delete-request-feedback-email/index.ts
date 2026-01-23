// Supabase Edge Function: send-delete-request-feedback-email
// Sends an email to administratie user when their delete request is approved or rejected
//
// To deploy:
// 1) Ensure Resend API key is set in Supabase Dashboard → Edge Functions → Secrets
// 2) Add secret: RESEND_API_KEY (your Resend API key)
// 3) Add secret: RESEND_FROM_EMAIL (verified email in Resend, e.g., support@bampro-uren.nl)
// 4) Deploy via Dashboard or CLI: supabase functions deploy send-delete-request-feedback-email --project-ref YOUR_PROJECT_REF
//
// Required secrets:
// - RESEND_API_KEY: Your Resend API key
// - RESEND_FROM_EMAIL: Verified sender email address in Resend
// - APP_URL (optional): Your app URL, defaults to https://bampro-uren.nl

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type DeleteRequestFeedbackEmailPayload = {
  requestedByEmail: string;  // Email van administratie user
  requestedByName: string;   // Naam van administratie user
  requestedUserEmail: string; // Email van gebruiker die verwijderd moest worden
  requestedUserName: string;  // Naam van gebruiker die verwijderd moest worden
  status: 'approved' | 'rejected';
  processedAt: string;        // ISO timestamp
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
  console.log("Edge Function send-delete-request-feedback-email called:", {
    method: req.method,
    url: req.url,
    hasBody: !!req.body,
  });

  try {
    // Parse request body with better error handling
    let payload: DeleteRequestFeedbackEmailPayload;
    try {
      const body = await req.json();
      console.log("Parsed request body:", body);
      payload = body as DeleteRequestFeedbackEmailPayload;
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
    
    const { requestedByEmail, requestedByName, requestedUserEmail, requestedUserName, status, processedAt } = payload;

    if (!requestedByEmail || !requestedUserEmail || !status) {
      return new Response(JSON.stringify({ error: "requestedByEmail, requestedUserEmail, and status are required" }), {
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

    // Format processed date
    const processedDate = processedAt ? new Date(processedAt).toLocaleString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : new Date().toLocaleString('nl-NL');

    // Determine email content based on status
    const isApproved = status === 'approved';
    const statusText = isApproved ? 'goedgekeurd' : 'afgewezen';
    const statusColor = isApproved ? '#16a34a' : '#dc2626';
    const statusBgColor = isApproved ? '#f0fdf4' : '#fef2f2';
    const statusBorderColor = isApproved ? '#16a34a' : '#dc2626';
    const actionText = isApproved 
      ? `${requestedUserName || requestedUserEmail} is verwijderd uit het systeem.`
      : `${requestedUserName || requestedUserEmail} blijft actief in het systeem.`;

    // Email HTML template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verzoek Verwijdering Gebruiker ${statusText}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${statusColor}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Verzoek ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Je verzoek om een gebruiker te verwijderen is ${statusText}.
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: ${statusBgColor}; border-radius: 6px; border-left: 4px solid ${statusBorderColor};">
                <p style="margin: 0 0 15px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Gebruiker:</p>
                <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 14px;">
                  <strong>Naam:</strong> ${requestedUserName || requestedUserEmail}
                </p>
                <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 14px;">
                  <strong>Email:</strong> ${requestedUserEmail}
                </p>
                <p style="margin: 15px 0 0 0; color: #4b5563; font-size: 14px; font-weight: 600;">
                  ${actionText}
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Verwerkt op:</p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">
                  ${processedDate}
                </p>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Je kunt altijd nieuwe verzoeken indienen via het admin panel.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                Dit is een geautomatiseerde email van het BAMPRO MARINE Timesheet Systeem.<br>
                Je ontvangt deze email omdat je een verzoek hebt ingediend om een gebruiker te verwijderen.
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
Verzoek Verwijdering Gebruiker ${statusText.charAt(0).toUpperCase() + statusText.slice(1)} - BAMPRO MARINE Timesheet Systeem

Je verzoek om een gebruiker te verwijderen is ${statusText}.

Gebruiker:
Naam: ${requestedUserName || requestedUserEmail}
Email: ${requestedUserEmail}

${actionText}

Verwerkt op: ${processedDate}

---
Dit is een geautomatiseerde email van het BAMPRO MARINE Timesheet Systeem.
Je ontvangt deze email omdat je een verzoek hebt ingediend om een gebruiker te verwijderen.
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
          to: requestedByEmail,
          subject: `Verzoek verwijdering ${requestedUserEmail} ${statusText}`,
          html: emailHtml,
          text: emailText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Resend API error:", result);
        return new Response(JSON.stringify({ 
          error: "Failed to send feedback email",
          details: result.message || result.error || "Resend API returned an error"
        }), {
          headers: corsHeaders,
          status: 500,
        });
      }

      console.log("Delete request feedback email sent successfully via Resend");

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Delete request feedback email sent successfully via Resend." 
      }), {
        headers: corsHeaders,
        status: 200,
      });
    } catch (emailError) {
      console.error("Error sending email via Resend:", emailError);
      return new Response(JSON.stringify({ 
        error: "Failed to send feedback email",
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
