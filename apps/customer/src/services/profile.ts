/**
 * BEVER Customer App — Profile Service
 *
 * Provides safe, scoped database operations for public.profiles.
 *
 * Security Principles:
 *   - Operating user is derived ONLY from the active Supabase session (auth.uid()).
 *   - Never accepts a user ID parameter from client UI.
 *   - Only updates the single column permitted by database permissions (full_name).
 *   - Database trigger handles updated_at automatically on the server.
 *   - Never attempts to read or write user role (role is fixed to 'customer' by DB trigger).
 *   - Never uses service-role keys.
 */

import { supabase } from './supabase';

export interface CustomerProfile {
  id: string;
  role: 'customer' | 'merchant' | 'rider' | 'admin';
  full_name: string;
  phone: string;
  avatar_url: string | null;
  fcm_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileOperationResult {
  success: boolean;
  profile?: CustomerProfile;
  error?: string;
}

/**
 * Fetches the authenticated user's profile from public.profiles.
 * Scoped strictly to auth.uid(). Returns null if no user is signed in.
 */
export async function fetchMyProfile(): Promise<CustomerProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone, avatar_url, fcm_token, is_active, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  // If profile row doesn't exist yet (DB trigger slight race condition), retry once after a brief delay
  if (!data && !error) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const retry = await supabase
      .from('profiles')
      .select('id, role, full_name, phone, avatar_url, fcm_token, is_active, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data as CustomerProfile | null;
}

/**
 * Updates the authenticated user's full_name in public.profiles.
 * Validates length and non-emptiness before executing update.
 */
export async function updateMyProfile(fullName: string): Promise<ProfileOperationResult> {
  const trimmedName = fullName.trim();

  if (!trimmedName) {
    return { success: false, error: 'Please enter your full name.' };
  }

  if (trimmedName.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters long.' };
  }

  if (trimmedName.length > 100) {
    return { success: false, error: 'Name must be 100 characters or less.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'User session has expired. Please sign in again.' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: trimmedName,
      })
      .eq('id', user.id)
      .select('id, role, full_name, phone, avatar_url, fcm_token, is_active, created_at, updated_at')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, profile: data as CustomerProfile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update profile.' };
  }
}
