// Supabase Edge Function: send-week-review-email
// Sends approval/rejection email for a confirmed week via Resend
//
// Required secrets:
// - RESEND_API_KEY
// - RESEND_FROM_EMAIL
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// Optional:
// - APP_URL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type Payload = {
  userId: string;
  weekStartDate: string; // YYYY-MM-DD (monday)
  weekNumber: number;
  year: number;
  status: "approved" | "rejected";
  comment?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-supabase-api-version, accept, accept-language, if-modified-since, if-none-match, x-requested-with",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const escapeHtml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    const { userId, weekNumber, year, status, comment } = body;

    if (!userId || !weekNumber || !year || !status) {
      return new Response(JSON.stringify({ error: "userId, weekNumber, year, status are required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "support@bampro-uren.nl";
    const appUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY secret is not configured" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", userId)
      .single();

    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: "Failed to fetch user email", details: userError?.message }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const safeComment = (comment || "").trim();

    const subject =
      status === "approved"
        ? `Timesheet approved - Week ${weekNumber} of ${year}`
        : `Timesheet rejected - Week ${weekNumber} of ${year}`;

    const headline = status === "approved" ? "Your timesheet was approved" : "Your timesheet was rejected";

    const bodyText =
      status === "approved"
        ? `Week ${weekNumber} of ${year} has been approved.`
        : `Week ${weekNumber} of ${year} has been rejected. Please review and correct your entries.`;

    // Calculate week date range for display (ISO week standard)
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

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet ${status === "approved" ? "Approval" : "Rejection"}</title>
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
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; font-weight: 600;">${escapeHtml(headline)}</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Hello ${escapeHtml(user.name || "there")},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${escapeHtml(bodyText)}
              </p>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">Week Period:</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px;">
                  ${weekStartStr} - ${weekEndStr}
                </p>
              </div>
              
              ${safeComment ? `<div style="margin: 20px 0; padding: 16px; background-color: #f9fafb; border-radius: 4px; border-left: 4px solid #6b7280;">
                <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: 600;">Comment:</p>
                <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 1.6;">${escapeHtml(safeComment)}</p>
              </div>` : ''}
              
              <div style="margin: 30px 0; text-align: center;">
                <a href="${appUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">Go to Timesheet</a>
              </div>
              
              ${status === "rejected" ? `<p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Please log in to your account and review your entries for this week.
              </p>` : ''}
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions, please contact your administrator.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                This is an automated email from BAMPRO MARINE Timesheet System.<br>
                You are receiving this email because you have an account on our platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [user.email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: "Failed to send email", details: text }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});

