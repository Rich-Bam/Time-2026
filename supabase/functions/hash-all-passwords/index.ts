// Supabase Edge Function: hash-all-passwords
// This function hashes all plaintext passwords in the users table
// 
// IMPORTANT: This should only be run ONCE after implementing password hashing
// After this, all new passwords will be automatically hashed
//
// To deploy:
// supabase functions deploy hash-all-passwords --project-ref YOUR_PROJECT_REF
//
// To invoke:
// curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/hash-all-passwords \
//   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
//   -H "Content-Type: application/json"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
// Use bcryptjs via esm.sh for Deno compatibility
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users with plaintext passwords
    // Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters
    const { data: users, error: fetchError } = await supabase
      .from("users")
      .select("id, email, password")
      .not("password", "like", "$2%"); // Get passwords that don't start with $2

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${fetchError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All passwords are already hashed!",
          hashed: 0 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Hash each password
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        // Hash the password with bcrypt (10 salt rounds)
        // bcryptjs uses async hash function
        const hashedPassword = await new Promise<string>((resolve, reject) => {
          bcrypt.hash(user.password, 10, (err, hash) => {
            if (err) reject(err);
            else resolve(hash);
          });
        });
        
        // Update the user with hashed password
        const { error: updateError } = await supabase
          .from("users")
          .update({ password: hashedPassword })
          .eq("id", user.id);

        if (updateError) {
          errorCount++;
          errors.push(`${user.email}: ${updateError.message}`);
        } else {
          successCount++;
        }
      } catch (err) {
        errorCount++;
        errors.push(`${user.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration complete: ${successCount} passwords hashed, ${errorCount} errors`,
        hashed: successCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : String(err) 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

