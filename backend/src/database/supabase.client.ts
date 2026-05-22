import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabase = createClient(env.supabaseUrl, env.supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
