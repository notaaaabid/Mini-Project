const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Supabase credentials not found in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('profiles').delete().ilike('email', '%lisa@test.com%');
  console.log("Delete profiles:", error || data);
  const { data: d2, error: e2 } = await supabase.from('profiles').delete().ilike('full_name', '%lisa martinez%');
  console.log("Delete profiles named lisa:", e2 || d2);
  const { data: cw, error: ew } = await supabase.from('wallets').delete().eq('user_id', 'd5');
  console.log("Delete wallets:", ew || cw);
}

run();
