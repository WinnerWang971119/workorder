import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

/**
 * Initialize Supabase client with service role key (admin access)
 * Used by Discord bot for all database operations
 */
export const supabase = createClient(
  config.supabase.url!,
  config.supabase.serviceRoleKey!
);
