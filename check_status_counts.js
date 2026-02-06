const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkStatusCounts() {
  // Get total count
  const { count: total } = await supabase
    .from('KIU Properties')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total listings in database: ${total}`);
  
  // Get status distribution
  const { data, error } = await supabase
    .from('KIU Properties')
    .select('STATUS, "GEO ID"');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Group by status
  const statusCounts = {};
  const weirdStatuses = [];
  
  data.forEach(row => {
    const status = (row.STATUS || '').trim().toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    
    // Check for non-standard statuses
    if (status !== 'AVAILABLE' && status !== 'SOLD' && status !== 'LEASED' && 
        status !== 'NOT AVAILABLE' && status !== 'TEMP HOLD' && status !== '') {
      weirdStatuses.push({ id: row['GEO ID'], status: row.STATUS });
    }
  });
  
  console.log('\nStatus Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  "${status}": ${count}`);
  });
  
  if (weirdStatuses.length > 0) {
    console.log('\nListings with unusual status values:');
    weirdStatuses.forEach(w => console.log(`  ${w.id}: "${w.status}"`));
  }
  
  // Check for "Available" vs "AVAILABLE" case sensitivity
  const availableExact = data.filter(r => r.STATUS === 'Available').length;
  const availableUpper = data.filter(r => (r.STATUS || '').toUpperCase() === 'AVAILABLE').length;
  console.log(`\nCase sensitivity check:`);
  console.log(`  Exact "Available": ${availableExact}`);
  console.log(`  Case-insensitive "AVAILABLE": ${availableUpper}`);
}

checkStatusCounts();
