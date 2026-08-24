import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? supabaseServiceKey;

const serverAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  serverAuthOptions,
);

export const supabaseAuth = createClient(
  supabaseUrl,
  supabasePublishableKey,
  serverAuthOptions,
);

export const supabase = supabaseAdmin;