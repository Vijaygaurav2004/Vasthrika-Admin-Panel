import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Create the Supabase client only in browser environment
export const supabase = isBrowser 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Type guard for Supabase client
export function isSupabaseClient(client: SupabaseClient | null): client is SupabaseClient {
  return client !== null;
} 