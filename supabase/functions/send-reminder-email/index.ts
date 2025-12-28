// Supabase Edge Function: send-reminder-email
// Sends reminder emails to users via Resend
//
// To deploy:
// 1) Set up Resend API key in Supabase Dashboard → Edge Functions → Secrets
// 2) Add secret: RESEND_API_KEY (your Resend API key)
// 3) Add secret: RESEND_FROM_EMAIL (verified email in Resend, e.g., noreply@bampro-uren.nl)
// 4) Deploy via Dashboard or CLI: supabase functions deploy send-reminder-email --project-ref YOUR_PROJECT_REF
//
// Required secrets:
// - RESEND_API_KEY: Your Resend API key
// - RESEND_FROM_EMAIL: Verified sender email address in Resend
// - APP_URL (optional): Your app URL, defaults to https://bampro-uren.nl

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type ReminderEmailPayload = {
  userIds: string[];
  weekNumber: number;
  year: number;
  message?: string;
};

// CORS headers - allow all headers that Supabase client and browser might send
// Supabase client automatically adds many headers, so we need to allow them all
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
    // Parse request body with better error handling
    let payload: ReminderEmailPayload;
    try {
      const body = await req.json();
      console.log("Parsed request body:", { userIds: body.userIds?.length, weekNumber: body.weekNumber, year: body.year });
      payload = body as ReminderEmailPayload;
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid request body. Expected JSON.", details: parseError instanceof Error ? parseError.message : String(parseError) }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const { userIds, weekNumber, year, message } = payload;

    if (!userIds || userIds.length === 0 || !weekNumber || !year) {
      console.error("Validation failed:", { userIds, weekNumber, year });
      return new Response(JSON.stringify({ error: "userIds, weekNumber, and year are required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get Resend API key and from email from environment
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "support@bampro-uren.nl";
    const appUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";

    console.log("Environment check:", {
      hasResendApiKey: !!resendApiKey,
      resendFromEmail,
      appUrl,
    });

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
      console.error("Missing Supabase credentials:", { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch user details for all userIds
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, name")
      .in("id", userIds);

    if (usersError || !users || users.length === 0) {
      console.error("Failed to fetch users:", { usersError, usersCount: users?.length });
      return new Response(JSON.stringify({ error: "Failed to fetch users or no users found", details: usersError?.message }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    console.log(`Found ${users.length} user(s) to send emails to`);

    // Calculate week date range for display (ISO week standard - same as AdminPanel)
    const getWeekDateRange = (weekNum: number, year: number) => {
      try {
        // Calculate the date of the first Thursday of the year (ISO week standard)
        const jan4 = new Date(year, 0, 4);
        const jan4Day = jan4.getDay() || 7; // Convert Sunday (0) to 7
        const daysToMonday = jan4Day === 1 ? 0 : 1 - jan4Day;
        
        // Get the Monday of week 1
        const week1Monday = new Date(year, 0, 4 + daysToMonday);
        
        // Calculate the Monday of the requested week
        const weekMonday = new Date(week1Monday);
        weekMonday.setDate(week1Monday.getDate() + (weekNum - 1) * 7);
        
        // Calculate the Sunday of that week
        const weekSunday = new Date(weekMonday);
        weekSunday.setDate(weekMonday.getDate() + 6);
        
        return { start: weekMonday, end: weekSunday };
      } catch (error) {
        console.error("Error calculating week date range:", error);
        // Fallback: return current week
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { start: monday, end: sunday };
      }
    };

    const weekRange = getWeekDateRange(weekNumber, year);
    const weekStartStr = weekRange.start.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const weekEndStr = weekRange.end.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Email HTML template
    const emailHtml = (userName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet Reminder</title>
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
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; font-weight: 600;">Timesheet Reminder</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Hello ${userName},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                This is a reminder to fill in your timesheet hours for <strong>Week ${weekNumber} of ${year}</strong>.
              </p>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">Week Period:</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px;">
                  ${weekStartStr} - ${weekEndStr}
                </p>
              </div>
              
              ${message ? `<p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">${message}</p>` : ''}
              
              <div style="margin: 30px 0; text-align: center;">
                <a href="${appUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">Go to Timesheet</a>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Please log in to your account and fill in your hours for this week as soon as possible.
              </p>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions, please contact your administrator.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                This is an automated reminder from BAMPRO MARINE Timesheet System.<br>
                You are receiving this email because you have an account on our platform.
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
    const emailText = (userName: string) => `
Timesheet Reminder - BAMPRO MARINE

Hello ${userName},

This is a reminder to fill in your timesheet hours for Week ${weekNumber} of ${year}.

Week Period: ${weekStartStr} - ${weekEndStr}

${message ? `\n${message}\n` : ''}

Please log in to your account and fill in your hours for this week as soon as possible:
${appUrl}

If you have any questions, please contact your administrator.

---
This is an automated reminder from BAMPRO MARINE Timesheet System.
    `.trim();

    // Send emails to all users
    const emailResults: Array<{ userId: string; email: string; success: boolean }> = [];
    const errors: Array<{ userId: string; email?: string; error: string }> = [];

    for (const user of users) {
      if (!user.email) {
        errors.push({ userId: user.id, error: "User has no email address" });
        continue;
      }

      try {
        console.log(`Sending email to ${user.email}...`);
        
        const emailPayload = {
          from: resendFromEmail,
          to: user.email,
          subject: `Timesheet Reminder - Week ${weekNumber} of ${year}`,
          html: emailHtml(user.name || user.email),
          text: emailText(user.name || user.email),
        };

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify(emailPayload),
        });

        console.log(`Resend API response status: ${response.status} for ${user.email}`);

        let result;
        try {
          result = await response.json();
        } catch (jsonError) {
          const responseText = await response.text();
          console.error(`Failed to parse Resend response for ${user.email}:`, responseText);
          errors.push({ userId: user.id, email: user.email, error: `Resend API returned invalid JSON: ${responseText.substring(0, 100)}` });
          continue;
        }

        if (!response.ok) {
          console.error(`Resend API error for ${user.email}:`, result);
          errors.push({ userId: user.id, email: user.email, error: result.message || result.error || "Failed to send email" });
        } else {
          console.log(`Email sent successfully to ${user.email}`);
          emailResults.push({ userId: user.id, email: user.email, success: true });
        }
      } catch (err) {
        console.error(`Exception sending email to ${user.email}:`, err);
        errors.push({ userId: user.id, email: user.email, error: err instanceof Error ? err.message : String(err) });
      }
    }

    console.log("Sending response:", {
      sent: emailResults.length,
      failed: errors.length,
    });

    return new Response(JSON.stringify({
      success: emailResults.length > 0,
      sent: emailResults.length,
      failed: errors.length,
      results: emailResults,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: corsHeaders,
      status: emailResults.length > 0 ? 200 : 500,
    });
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

