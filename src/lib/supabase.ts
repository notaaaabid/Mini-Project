
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // We manage sessions via sessionStorage in AuthContext, so disable
    // Supabase's own localStorage persistence to prevent stale session issues.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
});
