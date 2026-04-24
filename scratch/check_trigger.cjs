const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTrigger() {
    const { data, error } = await supabase.rpc('get_triggers'); // Assuming a custom RPC or I'll just try to query information_schema

    // If no get_triggers RPC, try querying via REST (might not work for info_schema)
    // Instead, I'll just check if the sync worked for other fields.
    
    console.log('Checking if the sync trigger is firing...');
}

checkTrigger();
