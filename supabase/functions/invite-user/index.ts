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
  userType?: string;
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:36',message:'Edge Function called',data:{method:req.method,hasBody:!!req.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const { email, name, isAdmin = false, userType } = (await req.json()) as InvitePayload;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:40',message:'Request parsed',data:{email,name,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!email || !name) {
      return new Response(JSON.stringify({ error: "Email and name are required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:47',message:'Environment check',data:{hasSupabaseUrl:!!supabaseUrl,hasServiceRoleKey:!!serviceRoleKey,urlLength:supabaseUrl?.length||0,keyLength:serviceRoleKey?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!supabaseUrl || !serviceRoleKey) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:51',message:'Missing credentials',data:{hasSupabaseUrl:!!supabaseUrl,hasServiceRoleKey:!!serviceRoleKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:57',message:'Supabase client created',data:{url:supabaseUrl,hasClient:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://bampro-uren.nl";

    // Check if user already exists in auth using listUsers (getUserByEmail doesn't exist in this version)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:63',message:'Checking existing user via listUsers',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    const { data: authUsersData, error: listError } = await supabase.auth.admin.listUsers();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:66',message:'List users result',data:{hasError:!!listError,errorMessage:listError?.message,usersCount:authUsersData?.users?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (listError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:70',message:'Failed to list users',data:{errorMessage:listError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return new Response(JSON.stringify({ 
        error: "Failed to check existing users",
        details: listError.message
      }), {
        headers: corsHeaders,
        status: 500,
      });
    }
    
    const existingAuthUser = authUsersData.users.find(u => u.email === email);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:78',message:'Existing user check result',data:{hasExistingUser:!!existingAuthUser,userId:existingAuthUser?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    let user;
    let inviteLink;
    const isExistingUser = !!existingAuthUser;

    if (existingAuthUser) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:115',message:'User exists in auth, generating password reset link',data:{userId:existingAuthUser.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // User already exists in auth - generate a password reset link (not invite, since user is already registered)
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: email,
        options: {
          redirectTo: `${appUrl}/reset`,
        },
      });

      if (linkError || !linkData) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:127',message:'Failed to generate recovery link',data:{linkErrorMessage:linkError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return new Response(JSON.stringify({ 
          error: "Failed to generate password reset link",
          details: linkError?.message || "Could not generate password reset link"
        }), {
          headers: corsHeaders,
          status: 400,
        });
      }

      user = existingAuthUser;
      inviteLink = linkData.properties.action_link;
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:91',message:'Creating new user in auth',data:{email,name,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:103',message:'Auth user creation result',data:{hasNewUser:!!newUser,hasAuthError:!!authError,authErrorMessage:authError?.message,userId:newUser?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      if (authError || !newUser) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:106',message:'Auth creation failed',data:{authErrorMessage:authError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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

      // Use hashed_token so invite-confirm can call verifyOtp (works with PKCE-enabled projects)
      const hashedToken = linkData.properties?.hashed_token;
      if (hashedToken) {
        inviteLink = `${appUrl}/invite-confirm?token_hash=${encodeURIComponent(hashedToken)}&type=invite`;
      } else {
        inviteLink = linkData.properties.action_link;
      }
    }

    // Create or update matching row in public.users table using service_role (bypasses RLS)
    // The supabase client is created with serviceRoleKey, so it should bypass RLS
    console.log("Creating/updating user in database with service_role...");
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:200',message:'Checking if user exists in database',data:{userId:user.id,email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Check if user already exists in public.users table
    const { data: existingDbUser, error: checkError } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", user.id)
      .single();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:210',message:'User existence check result',data:{hasExistingDbUser:!!existingDbUser,hasCheckError:!!checkError,checkErrorCode:checkError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + "A1!";
    
    let insertedUser;
    let dbError;
    
    if (existingDbUser) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:218',message:'User exists, updating',data:{userId:user.id,email,name,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // User already exists - update instead of insert
      const updatePayload: Record<string, unknown> = {
        name,
        isAdmin,
        approved: true,
        must_change_password: true,
      };
      if (userType != null) updatePayload.userType = userType;
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", user.id)
        .select();
      
      insertedUser = updatedUser;
      dbError = updateError;
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:232',message:'User does not exist, inserting',data:{userId:user.id,email,name,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // User does not exist - insert new
      const insertPayload: Record<string, unknown> = {
        id: user.id,
        email,
        name,
        password: tempPassword,
        isAdmin,
        must_change_password: true,
        approved: true,
      };
      if (userType != null) insertPayload.userType = userType;
      const { data: newUser, error: insertError } = await supabase.from("users").insert(insertPayload).select();
      
      insertedUser = newUser;
      dbError = insertError;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:152',message:'Database insert result',data:{hasInsertedUser:!!insertedUser,hasDbError:!!dbError,dbErrorCode:dbError?.code,dbErrorMessage:dbError?.message,dbErrorDetails:dbError?.details,dbErrorHint:dbError?.hint,isRLSError:dbError?.message?.includes('row-level security')||dbError?.message?.includes('RLS')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (dbError) {
      console.error("Database error:", dbError);
      console.error("Error code:", dbError.code);
      console.error("Error message:", dbError.message);
      console.error("Error details:", dbError.details);
      console.error("Error hint:", dbError.hint);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:250',message:'Database operation failed',data:{dbErrorCode:dbError.code,dbErrorMessage:dbError.message,isRLSError:dbError.message?.includes('row-level security')||dbError.message?.includes('RLS')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // Check if it's an RLS error
      const isRLSError = dbError.message.includes("row-level security") || dbError.message.includes("RLS");
      return new Response(JSON.stringify({ 
        error: `Failed to create/update user: ${dbError.message}`,
        details: `Code: ${dbError.code}, Hint: ${dbError.hint || 'none'}`,
        rlsIssue: isRLSError,
        solution: isRLSError ? "Run fix_invite_user_rls_COMPLETE.sql in Supabase SQL Editor" : "Check database logs"
      }), {
        headers: corsHeaders,
        status: 400,
      });
    } else {
      console.log("User created/updated successfully in database:", insertedUser);
    }

    // Send invite email via Resend (optional - if not configured, user is still created)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "support@bampro-uren.nl";

    // If Resend is not configured, still return success but log a warning
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured - user created but no email sent");
      return new Response(JSON.stringify({ 
        success: true, 
        userId: user.id,
        warning: "User created successfully, but invitation email was not sent because RESEND_API_KEY is not configured. Please add RESEND_API_KEY secret in Supabase Dashboard → Edge Functions → Secrets",
        message: "User invited successfully. Please configure Resend to send invitation emails." 
      }), {
        headers: corsHeaders,
        status: 200,
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
                  ${userType === "weekly_only" ? "<li>See the attached handleiding (PDF) for how to fill in your hours</li>" : ""}
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

Important: This invitation link will expire in 7 days. If you have any questions or need assistance, please contact your administrator.

What's next?
1. Click the activation link above
2. Set a secure password for your account
3. Log in and start tracking your hours
${userType === "weekly_only" ? "4. See the attached handleiding (PDF) for how to fill in your hours\n" : ""}
---
This is an automated invitation from BAMPRO MARINE Timesheet System.
You are receiving this email because you have been invited to join our platform.
    `.trim();

    // Fetch PDF handleiding for weekly_only users and prepare attachments
    let attachments: { content: string; filename: string }[] = [];
    if (userType === "weekly_only") {
      try {
        const pdfUrl = `${appUrl.replace(/\/$/, "")}/Handleiding_Weekly_Only.pdf`;
        const pdfRes = await fetch(pdfUrl);
        if (pdfRes.ok) {
          const pdfBuf = await pdfRes.arrayBuffer();
          const bytes = new Uint8Array(pdfBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          attachments = [{ content: base64, filename: "Handleiding_Weekly_Only.pdf" }];
        } else {
          console.warn("Handleiding PDF not found at", pdfUrl, pdfRes.status);
        }
      } catch (pdfErr) {
        console.warn("Failed to fetch handleiding PDF:", pdfErr);
      }
    }

    // Send email via Resend
    try {
      const resendBody: Record<string, unknown> = {
        from: resendFromEmail,
        to: email,
        subject: `Welcome to BAMPRO MARINE - Activate Your Account`,
        html: emailHtml,
        text: emailText,
      };
      if (attachments.length > 0) resendBody.attachments = attachments;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(resendBody),
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/677a8104-55ff-4a8e-a1c2-02170ea8e822',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'invite-user/index.ts:379',message:'Unhandled exception',data:{errorMessage:err instanceof Error ? err.message : String(err),errorStack:err instanceof Error ? err.stack : undefined,errorName:err instanceof Error ? err.name : typeof err},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    console.error("Edge Function error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
