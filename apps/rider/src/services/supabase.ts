import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Public client values (safe to ship; row-level security protects the data). A .env value overrides them.
const url = process.env['EXPO_PUBLIC_SUPABASE_URL'] || 'https://atuaafowdoijojdmtgcr.supabase.co';
const key = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0dWFhZm93ZG9pam9qZG10Z2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MjIxOTEsImV4cCI6MjEwNjQ5ODE5MX0.hEwDJgb3ZKcBYrZ_iBRcB1YrgOV1JAYYjI1F4QriQJs';

export const supabase = createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
