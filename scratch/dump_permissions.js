import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allRolePerms, error } = await supabase
    .from('luxe_listing_role_permissions')
    .select('*');
  console.log('All role permissions count:', allRolePerms?.length, error);
  console.log(JSON.stringify(allRolePerms, null, 2));
}

run();
