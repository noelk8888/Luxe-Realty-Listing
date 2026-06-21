import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspect() {
  const { data, error } = await supabase
    .from('KIU Properties')
    .select('PHOTO');

  if (error) {
    console.error(error);
    return;
  }

  const domains = {};
  data.forEach(row => {
    const link = row.PHOTO;
    if (link) {
      try {
        const url = new URL(link.trim());
        domains[url.hostname] = (domains[url.hostname] || 0) + 1;
      } catch (e) {
        domains['invalid'] = (domains['invalid'] || 0) + 1;
      }
    }
  });

  console.log('Domains in PHOTO column:', domains);
}

inspect();
