import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Production fallback constants (public anon key is safe for client-side distribution with RLS)
const DEFAULT_SUPABASE_URL = 'https://mnxyrrfgiioovrwwpqll.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_uPUIJ76KTa9J0lFyyS9p2w_Y23YkRd4';

const rawSupabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

// Sanitize URL: strip trailing slashes or '/rest/v1' suffix if user copied from Data API
export const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) return false;
  if (supabaseUrl.includes('your-project-id')) return false;
  return true;
}

export const supabase = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

