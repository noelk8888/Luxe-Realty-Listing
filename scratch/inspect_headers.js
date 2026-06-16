import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectHeaders() {
  const { data, error } = await supabase
    .from('KIU Properties')
    .select('"GEO ID", "MAIN", "Extracted Sale Price", "Extracted Lease Price"')
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const item of data) {
    const main = item['MAIN'] || '';
    const lines = main.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0].toUpperCase();
      const secondLine = lines[1] ? lines[1].toUpperCase() : '';
      const thirdLine = lines[2] ? lines[2].toUpperCase() : '';
      
      const combined = `${firstLine} | ${secondLine} | ${thirdLine}`;
      if (combined.includes('LEASE') || combined.includes('SALE')) {
        console.log(`ID: ${item['GEO ID']} | Header: "${firstLine}" / "${secondLine}" | SalePrice: ${item['Extracted Sale Price']} | LeasePrice: ${item['Extracted Lease Price']}`);
      }
    }
  }
}

inspectHeaders();
