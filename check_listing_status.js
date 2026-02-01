// Quick script to check listing status in Supabase
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkListing(geoId) {
  const { data, error } = await supabase
    .from('KIU Properties')
    .select('"GEO ID", "MAIN", "TYPE", "STATUS", "COMMENTS", "Extracted Sale Price", "Extracted Lease Price"')
    .eq('"GEO ID"', geoId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Listing Details ===');
  console.log(`GEO ID: ${data['GEO ID']}`);
  console.log(`STATUS (database): "${data['STATUS']}"`);
  console.log(`TYPE: ${data['TYPE']}`);
  console.log(`Price: ${data['Extracted Sale Price']}`);
  console.log(`\nMAIN field preview:`);
  console.log(data['MAIN']?.substring(0, 300));
  console.log(`\nCOMMENTS field preview:`);
  console.log(data['COMMENTS']?.substring(0, 300));

  // Check if SOLD appears in text
  const mainUpper = (data['MAIN'] || '').toUpperCase();
  const commentsUpper = (data['COMMENTS'] || '').toUpperCase();
  const hasSoldInMain = mainUpper.includes('SOLD');
  const hasSoldInComments = commentsUpper.includes('SOLD');

  console.log(`\n=== Status Detection ===`);
  console.log(`"SOLD" in MAIN: ${hasSoldInMain}`);
  console.log(`"SOLD" in COMMENTS: ${hasSoldInComments}`);
  console.log(`Database STATUS field: "${data['STATUS']}"`);
}

const listingId = process.argv[2] || 'G11200';
checkListing(listingId);
