// Local script to hash all plaintext passwords
// Run with: node migrate-passwords.mjs
//
// Requires:
// - npm install bcryptjs dotenv
// - Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local
//   OR set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set these in .env.local or as environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function migratePasswords() {
  console.log('🔍 Fetching users with plaintext passwords...');
  
  // Get all users with plaintext passwords (not starting with $2)
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('id, email, password')
    .not('password', 'like', '$2%');

  if (fetchError) {
    console.error('❌ Error fetching users:', fetchError.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('✅ All passwords are already hashed!');
    return;
  }

  console.log(`📊 Found ${users.length} users with plaintext passwords`);
  console.log('🔐 Starting migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // Update the user
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', user.id);

      if (updateError) {
        console.error(`❌ ${user.email}: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${user.email}: Password hashed`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ ${user.email}: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${users.length}`);

  if (errorCount === 0) {
    console.log('\n🎉 All passwords have been successfully hashed!');
  }
}

// Run migration
migratePasswords().catch(console.error);

