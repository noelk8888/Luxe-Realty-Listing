// Quick script to update listing status in Supabase
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for updates
);

async function updateListingStatus(geoId, newStatus) {
  console.log(`\n🔄 Updating ${geoId} status to "${newStatus}"...`);

  const { data, error } = await supabase
    .from('KIU Properties')
    .update({ 'STATUS': newStatus })
    .eq('"GEO ID"', geoId)
    .select();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Successfully updated!');
  console.log(data);
}

const listingId = process.argv[2] || 'G11200';
const status = process.argv[3] || 'SOLD';

updateListingStatus(listingId, status);
