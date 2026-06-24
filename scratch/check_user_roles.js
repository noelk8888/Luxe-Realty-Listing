import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: users, error } = await supabase
    .from('luxe_listing_users')
    .select('email, role');
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  const roles = {};
  users.forEach(u => {
    roles[u.role] = (roles[u.role] || 0) + 1;
  });
  console.log('User roles distribution:', roles);
  console.log('Detailed list:');
  users.forEach(u => {
    console.log(`  ${u.email}: ${u.role}`);
  });
}

run();
