import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allUserOverrides, error } = await supabase
    .from('user_permission_overrides')
    .select('*');
  console.log('All user overrides count:', allUserOverrides?.length, error);
  console.log(JSON.stringify(allUserOverrides, null, 2));
}

run();
