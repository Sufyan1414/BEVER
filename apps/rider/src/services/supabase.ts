import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env['EXPO_PUBLIC_SUPABASE_URL'] || 'https://placeholder.supabase.co';
const key = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || 'placeholder-anon-key';

export const supabase = createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
