import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectPhotos() {
  const { data, error } = await supabase
    .from('KIU Properties')
    .select('"GEO ID", "PHOTO", "STATUS"')
    .in('GEO ID', ['B12543', 'G12540', 'G12542']);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Query result:');
  data.forEach(row => {
    console.log(`GEO ID: ${row['GEO ID']}, Photo Link: "${row['PHOTO']}"`);
  });
}

inspectPhotos();
