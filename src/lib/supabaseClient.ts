import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_REF = 'ihtmorgmsfptcmblvpnl';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables.');
}

export const SUPABASE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;
export const SUPABASE_PUBLISHABLE_KEY = supabasePublishableKey;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
