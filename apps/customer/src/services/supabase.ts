/**
 * BEVER Customer App — Supabase Client
 *
 * This is the single Supabase client for the customer app.
 *
 * WHY this lives here (not in packages/supabase):
 *   packages/supabase is a Supabase CLI configuration package (migrations,
 *   RLS policies, config.toml). It does NOT export a JavaScript client.
 *   Therefore this singleton here is NOT a duplicate — it is the only client.
 *
 * Session persistence:
 *   supabase-js requires a custom storage adapter on React Native.
 *   We use @react-native-async-storage/async-storage, already in package.json.
 *
 * Environment variables:
 *   EXPO_PUBLIC_SUPABASE_URL  — Supabase project URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY — Supabase anon (public) key
 *
 *   These must be set in apps/customer/.env before the app can connect.
 *   Without them the client is created with placeholder values and all
 *   network calls will fail with a clear error — the app will NOT crash on
 *   startup.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'];
const rawKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

const isConfigured = Boolean(rawUrl && rawUrl.trim() !== '') && Boolean(rawKey && rawKey.trim() !== '');

const supabaseUrl = isConfigured ? rawUrl! : 'https://placeholder.supabase.co';
const supabaseAnonKey = isConfigured ? rawKey! : 'placeholder-anon-key';

if (__DEV__ && !isConfigured) {
  console.warn(
    '[BEVER] Supabase environment variables are not set.\n' +
      'Create apps/customer/.env with:\n' +
      '  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\n' +
      '  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key\n' +
      'The app will load but network calls will fail until valid credentials are provided.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
