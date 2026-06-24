import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = 'iamnoel888@gmail.com';
  console.log('Querying luxe_listing_users for:', email);
  const { data: users, error: userError } = await supabase
    .from('luxe_listing_users')
    .select('*')
    .eq('email', email);
  console.log('Users result:', users, userError);

  console.log('\nQuerying role permissions for role V1:');
  const { data: rolePerms, error: rolePermError } = await supabase
    .from('luxe_listing_role_permissions')
    .select('*')
    .eq('role', 'V1');
  console.log('Role permissions result:', rolePerms, rolePermError);

  console.log('\nQuerying user overrides for:', email);
  const { data: overrides, error: overrideError } = await supabase
    .from('user_permission_overrides')
    .select('*')
    .eq('user_email', email);
  console.log('User overrides result:', overrides, overrideError);
}

run();
