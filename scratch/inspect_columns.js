import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findExistingDuplicates() {
  const { data, error } = await supabase
    .from('KIU Properties')
    .select('"GEO ID", STATUS, MAIN, COMMENTS')
    // We want to fetch rows where MAIN contains DUPLICATE (case-insensitive)
    .ilike('MAIN', '%DUPLICATE%')
    .limit(10);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log(`Found ${data.length} listings containing "DUPLICATE" in MAIN:`);
  data.forEach((row, i) => {
    console.log(`\n--- Duplicate #${i + 1} ---`);
    console.log(`GEO ID: ${row['GEO ID']}`);
    console.log(`STATUS: ${row['STATUS']}`);
    console.log(`MAIN (first 100 chars): ${row['MAIN']?.substring(0, 100).replace(/\n/g, '\\n')}`);
    console.log(`COMMENTS: ${row['COMMENTS']}`);
  });
}

findExistingDuplicates();
