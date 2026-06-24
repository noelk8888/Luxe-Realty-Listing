import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Setting view_col_ac (GEO ID) to true for V2 role...');
  const { data: d1, error: e1 } = await supabase
    .from('luxe_listing_role_permissions')
    .upsert(
      { role: 'V2', feature: 'view_col_ac', enabled: true },
      { onConflict: 'role,feature' }
    );
  console.log('Result 1:', d1, e1);

  console.log('Setting geo_id_click (GEO ID Click) to false for V2 role...');
  const { data: d2, error: e2 } = await supabase
    .from('luxe_listing_role_permissions')
    .upsert(
      { role: 'V2', feature: 'geo_id_click', enabled: false },
      { onConflict: 'role,feature' }
    );
  console.log('Result 2:', d2, e2);
}

run();
