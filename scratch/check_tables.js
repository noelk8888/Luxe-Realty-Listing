import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTables() {
  const potentialTables = ['KIU Properties', 'listings', 'duplicates', 'original_duplicates', 'luxe_listing_role_permissions', 'user_permission_overrides'];
  
  console.log('Testing table existence:');
  for (const table of potentialTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`  Table [${table}] does NOT exist or error: ${error.message}`);
      } else {
        console.log(`  Table [${table}] EXISTS with ${count} rows.`);
      }
    } catch (e) {
      console.log(`  Table [${table}] failed to query: ${e.message}`);
    }
  }
}

listTables();
