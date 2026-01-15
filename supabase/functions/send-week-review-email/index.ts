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
    const commentHtml = safeComment ? `<p style="margin:16px 0 0 0;"><strong>Comment / Opmerking:</strong><br>${escapeHtml(safeComment)}</p>` : "";

    const subject =
      status === "approved"
        ? `Timesheet approved - Week ${weekNumber} (${year})`
        : `Timesheet rejected - Week ${weekNumber} (${year})`;

    const headlineEn = status === "approved" ? "Your timesheet was approved" : "Your timesheet was rejected";
    const headlineNl = status === "approved" ? "Je weekstaat is goedgekeurd" : "Je weekstaat is afgekeurd";

    const bodyEn =
      status === "approved"
        ? `Week ${weekNumber} of ${year} has been approved.`
        : `Week ${weekNumber} of ${year} has been rejected. Please review and correct your entries.`;

    const bodyNl =
      status === "approved"
        ? `Week ${weekNumber} van ${year} is goedgekeurd.`
        : `Week ${weekNumber} van ${year} is afgekeurd. Controleer en corrigeer je invoer.`;

    const ctaTextEn = "Open BAMPRO Timesheet";
    const ctaTextNl = "Open BAMPRO Urenregistratie";

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Timesheet review</title>
  </head>
  <body style="font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 24px;">
    <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: #ea580c; color: #fff; padding: 16px 20px;">
        <div style="font-size: 18px; font-weight: 700;">BAMPRO MARINE</div>
        <div style="font-size: 12px; opacity: 0.9;">Timesheet System</div>
      </div>
      <div style="padding: 18px 20px; color: #111827;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px;">${escapeHtml(headlineEn)}</h2>
        <p style="margin: 0; color: #374151;">${escapeHtml(bodyEn)}</p>

        <hr style="border:0; border-top:1px solid #e5e7eb; margin:16px 0;" />

        <h2 style="margin: 0 0 8px 0; font-size: 18px;">${escapeHtml(headlineNl)}</h2>
        <p style="margin: 0; color: #374151;">${escapeHtml(bodyNl)}</p>

        ${commentHtml}

        <div style="margin-top: 18px;">
          <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;">
            ${escapeHtml(ctaTextEn)} / ${escapeHtml(ctaTextNl)}
          </a>
        </div>
      </div>
      <div style="padding: 12px 20px; background: #f9fafb; color: #6b7280; font-size: 12px;">
        This is an automated email. / Dit is een automatische e-mail.
      </div>
    </div>
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

