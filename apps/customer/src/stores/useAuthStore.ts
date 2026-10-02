/**
 * BEVER Customer App — Auth & Profile Store
 *
 * Manages Supabase session, authenticated user, and customer profile state.
 *
 * Architecture:
 *   - Holds session/user state derived from Supabase Auth.
 *   - Holds customer profile state fetched from public.profiles.
 *   - Database is the source of truth for session and profile.
 *   - Never fabricates roles or sessions.
 *   - Subscribes to onAuthStateChange and synchronizes profile reactively.
 */

import { create } from 'zustand';
import type { Session, User, Subscription, AuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { fetchMyProfile, updateMyProfile, type CustomerProfile } from '../services/profile';

interface AuthActionResult {
  success: boolean;
  error?: string;
}

interface AuthState {
  /** Active Supabase session, or null if unauthenticated */
  session: Session | null;
  /** Authenticated Supabase user, or null if unauthenticated */
  user: User | null;
  /** Customer profile record from public.profiles, or null */
  profile: CustomerProfile | null;
  /** True while initial session and profile check is running */
  isLoading: boolean;
  /** True while profile is specifically being fetched/updated */
  isProfileLoading: boolean;

  /** Initialize store: reads session and profile from Supabase */
  initialize: () => () => void;
  /** Requests SMS OTP code */
  sendPhoneOtp: (phone: string) => Promise<AuthActionResult>;
  /** Verifies SMS OTP code */
  verifyPhoneOtp: (phone: string, token: string) => Promise<AuthActionResult>;
  /** Loads current user's profile from database */
  loadProfile: () => Promise<CustomerProfile | null>;
  /** Updates current user's full_name in database */
  updateProfileName: (fullName: string) => Promise<AuthActionResult>;
  /** Signs out current user */
  signOut: () => Promise<void>;
}

function parseSupabaseError(error: AuthError | null | undefined): string {
  if (!error) return 'An unknown error occurred.';

  const message = error.message || '';
  const status = error.status;

  if (
    message.toLowerCase().includes('provider is disabled') ||
    message.toLowerCase().includes('unsupported phone provider') ||
    message.toLowerCase().includes('sms provider') ||
    message.toLowerCase().includes('not configured')
  ) {
    return 'Phone authentication is currently unavailable because the SMS provider is not configured on the server. Please check Supabase project settings.';
  }

  if (
    message.toLowerCase().includes('invalid token') ||
    message.toLowerCase().includes('token has expired') ||
    message.toLowerCase().includes('otp expired') ||
    message.toLowerCase().includes('invalid otp')
  ) {
    return 'The verification code is invalid or has expired. Please check the code and try again or request a new one.';
  }

  if (
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('for security purposes') ||
    status === 429
  ) {
    return 'Too many OTP requests. Please wait a few minutes before trying again.';
  }

  if (message.toLowerCase().includes('invalid phone') || status === 400) {
    return message || 'Invalid phone number format. Please ensure your number is entered correctly.';
  }

  return message || 'Authentication failed. Please check your network connection and try again.';
}

export const useAuthStore = create<AuthState>((set, get) => {
  let _subscription: Subscription | null = null;

  const loadUserProfile = async (user: User | null): Promise<CustomerProfile | null> => {
    if (!user) {
      set({ profile: null, isProfileLoading: false });
      return null;
    }

    set({ isProfileLoading: true });
    try {
      const profileData = await fetchMyProfile();
      set({ profile: profileData, isProfileLoading: false });
      return profileData;
    } catch {
      set({ profile: null, isProfileLoading: false });
      return null;
    }
  };

  return {
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    isProfileLoading: false,

    initialize: () => {
      // Step 1: Read session & load profile
      supabase.auth
        .getSession()
        .then(async ({ data }) => {
          const currentSession = data.session;
          const currentUser = currentSession?.user ?? null;
          set({ session: currentSession, user: currentUser });

          if (currentUser) {
            await loadUserProfile(currentUser);
          }

          set({ isLoading: false });
        })
        .catch(() => {
          set({ session: null, user: null, profile: null, isLoading: false });
        });

      // Step 2: Subscribe to auth state changes
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const currentUser = session?.user ?? null;
        set({ session, user: currentUser });

        if (currentUser) {
          await loadUserProfile(currentUser);
        } else {
          set({ profile: null, isProfileLoading: false });
        }

        set({ isLoading: false });
      });

      _subscription = data.subscription;

      return () => {
        _subscription?.unsubscribe();
        _subscription = null;
      };
    },

    sendPhoneOtp: async (phone: string): Promise<AuthActionResult> => {
      try {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) {
          return { success: false, error: parseSupabaseError(error) };
        }
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Network error while requesting OTP.',
        };
      }
    },

    verifyPhoneOtp: async (phone: string, token: string): Promise<AuthActionResult> => {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms',
        });

        if (error) {
          return { success: false, error: parseSupabaseError(error) };
        }

        if (data.session) {
          set({ session: data.session, user: data.session.user });
          await loadUserProfile(data.session.user);
        }

        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Network error while verifying OTP code.',
        };
      }
    },

    loadProfile: async (): Promise<CustomerProfile | null> => {
      const { user } = get();
      return loadUserProfile(user);
    },

    updateProfileName: async (fullName: string): Promise<AuthActionResult> => {
      set({ isProfileLoading: true });
      const result = await updateMyProfile(fullName);

      if (result.success && result.profile) {
        set({ profile: result.profile, isProfileLoading: false });
        return { success: true };
      }

      set({ isProfileLoading: false });
      return { success: false, error: result.error || 'Could not update profile.' };
    },

    signOut: async () => {
      await supabase.auth.signOut();
      set({ session: null, user: null, profile: null, isLoading: false, isProfileLoading: false });
    },
  };
});
