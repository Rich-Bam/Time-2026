// Supabase Edge Function: send-week-excel-email
// Sends weekly timesheet Excel file via email using Resend
//
// To deploy:
// 1) Ensure Resend API key is set in Supabase Dashboard → Edge Functions → Secrets
// 2) Add secret: RESEND_API_KEY (your Resend API key)
// 3) Add secret: RESEND_FROM_EMAIL (verified email in Resend, e.g., noreply@bampro-uren.nl)
// 4) Deploy via Dashboard or CLI: supabase functions deploy send-week-excel-email --project-ref YOUR_PROJECT_REF
//
// Required secrets:
// - RESEND_API_KEY: Your Resend API key
// - RESEND_FROM_EMAIL: Verified sender email address in Resend

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type WeekExcelEmailPayload = {
  userId: string;
  userName: string;
  userEmail: string;
  weekNumber: number;
  year: number;
  dateFrom: string;
  dateTo: string;
  excelBase64: string;
  recipientEmails: string[]; // Changed to array to support multiple recipients
  filename: string;
};

// CORS headers - allow all headers that Supabase client and browser might send
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-supabase-api-version, accept, accept-language, if-modified-since, if-none-match, x-requested-with",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Log incoming request for debugging
  console.log("Edge Function called:", {
    method: req.method,
    url: req.url,
    hasBody: !!req.body,
  });

  try {
    // Parse request body
    let payload: WeekExcelEmailPayload;
    try {
      const body = await req.json();
      console.log("Parsed request body:", { 
        userId: body.userId, 
        userName: body.userName,
        weekNumber: body.weekNumber, 
        year: body.year,
        recipientEmails: body.recipientEmails,
        hasExcelBase64: !!body.excelBase64,
      });
      payload = body as WeekExcelEmailPayload;
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid request body. Expected JSON.", details: parseError instanceof Error ? parseError.message : String(parseError) }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const { userId, userName, userEmail, weekNumber, year, dateFrom, dateTo, excelBase64, recipientEmails, filename } = payload;

    if (!userId || !userName || !weekNumber || !year || !excelBase64 || !recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0 || !filename) {
      console.error("Validation failed:", { userId, userName, weekNumber, year, hasExcelBase64: !!excelBase64, recipientEmails, filename });
      return new Response(JSON.stringify({ error: "userId, userName, weekNumber, year, excelBase64, recipientEmails (array), and filename are required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get Resend API key and from email from environment
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "support@bampro-uren.nl";

    console.log("Environment check:", {
      hasResendApiKey: !!resendApiKey,
      resendFromEmail,
    });

    if (!resendApiKey) {
      console.error("RESEND_API_KEY secret is not configured");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY secret is not configured" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    // Format dates for display
    const formatDateDisplay = (dateStr: string) => {
      try {
        const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
        return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      } catch (err) {
        return dateStr;
      }
    };

    const weekStartStr = formatDateDisplay(dateFrom);
    const weekEndStr = formatDateDisplay(dateTo);

    // Email HTML template - matches styling from send-reminder-email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Timesheet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ea580c; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">BAMPRO MARINE</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; font-weight: 600;">Weekly Timesheet Received</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                You have received a weekly timesheet for <strong>Week ${weekNumber} of ${year}</strong>.
              </p>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">Week Period:</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px;">
                  ${weekStartStr} - ${weekEndStr}
                </p>
              </div>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #d1d5db; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #374151; font-size: 14px; font-weight: 600;">Employee Information:</p>
                <p style="margin: 8px 0 0 0; color: #4b5563; font-size: 16px;">
                  <strong>Name:</strong> ${userName}<br>
                  ${userEmail ? `<strong>Email:</strong> ${userEmail}` : ''}
                </p>
              </div>
              
              <p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                The Excel timesheet file is attached to this email. Please review the timesheet and process accordingly.
              </p>
              
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions about this timesheet, please contact the employee directly.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                This is an automated email from BAMPRO MARINE Timesheet System.<br>
                The timesheet was sent directly from the weekly timesheet entry system.
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
Weekly Timesheet - BAMPRO MARINE

You have received a weekly timesheet for Week ${weekNumber} of ${year}.

Week Period: ${weekStartStr} - ${weekEndStr}

Employee Information:
Name: ${userName}
${userEmail ? `Email: ${userEmail}` : ''}

The Excel timesheet file is attached to this email. Please review the timesheet and process accordingly.

If you have any questions about this timesheet, please contact the employee directly.

---
This is an automated email from BAMPRO MARINE Timesheet System.
The timesheet was sent directly from the weekly timesheet entry system.
    `.trim();

    // Send email via Resend with attachment
    try {
      console.log(`Sending email to ${recipientEmails.join(', ')}...`);
      
      const emailPayload = {
        from: resendFromEmail,
        to: recipientEmails, // Resend supports array of email addresses
        subject: `Weekly Timesheet - Week ${weekNumber} ${year} - ${userName}`,
        html: emailHtml,
        text: emailText,
        attachments: [
          {
            filename: filename,
            content: excelBase64, // Resend expects base64 string directly
          },
        ],
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailPayload),
      });

      console.log(`Resend API response status: ${response.status} for ${recipientEmails.join(', ')}`);

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        const responseText = await response.text();
        console.error(`Failed to parse Resend response for ${recipientEmails.join(', ')}:`, responseText);
        return new Response(JSON.stringify({ 
          error: `Resend API returned invalid JSON: ${responseText.substring(0, 100)}` 
        }), {
          headers: corsHeaders,
          status: 500,
        });
      }

      if (!response.ok) {
        console.error(`Resend API error for ${recipientEmails.join(', ')}:`, result);
        return new Response(JSON.stringify({ 
          error: result.message || result.error || "Failed to send email",
          details: result 
        }), {
          headers: corsHeaders,
          status: 500,
        });
      }

      console.log(`Email sent successfully to ${recipientEmails.join(', ')}`);

      return new Response(JSON.stringify({
        success: true,
        message: `Email sent successfully to ${recipientEmails.join(', ')}`,
      }), {
        headers: corsHeaders,
        status: 200,
      });
    } catch (err) {
      console.error(`Exception sending email to ${recipientEmails.join(', ')}:`, err);
      return new Response(JSON.stringify({ 
        error: "Failed to send email",
        details: err instanceof Error ? err.message : String(err)
      }), {
        headers: corsHeaders,
        status: 500,
      });
    }
  } catch (err) {
    console.error("Edge Function error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorStack,
    }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
