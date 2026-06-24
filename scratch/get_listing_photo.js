import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('KIU Properties')
    .select('*')
    .eq('GEO ID', 'G02734')
    .single();

  if (error) {
    console.error('Error fetching listing:', error);
    return;
  }

  console.log('Listing details:', JSON.stringify(data, null, 2));
}

run();
