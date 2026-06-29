import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
    let query = supabase.from('KIU Properties').select('*').limit(1);
    
    const queryTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 15000);
    });

    try {
        console.log("Awaiting Promise.race...");
        const res = await Promise.race([query, queryTimeout]);
        console.log("Promise.race resolved!");
        console.log(res.data ? `Got data length: ${res.data.length}` : 'No data', res.error);
    } catch (e) {
        console.log("Promise.race threw:", e.message);
    }
}
test();
