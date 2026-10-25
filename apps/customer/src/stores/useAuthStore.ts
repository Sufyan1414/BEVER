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
import { validateAndFormatIndianPhone, phoneToInternalAuthEmail } from '../services/phone';

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
  /**
   * True only when the customer is authenticated AND has a non-empty full_name.
   * AppNavigator reads this as the single source of truth to decide whether
   * to show ProfileSetup or AppTabs. Never derive this in screens.
   */
  isProfileComplete: boolean;

  /** Initialize store: reads session and profile from Supabase */
  initialize: () => () => void;
  /** Signs up new user with phone number and PIN */
  signUpWithPhonePin: (phone: string, pin: string) => Promise<AuthActionResult>;
  /** Signs in existing user with phone number and PIN */
  signInWithPhonePin: (phone: string, pin: string) => Promise<AuthActionResult>;
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
    message.toLowerCase().includes('invalid login credentials') ||
    message.toLowerCase().includes('invalid credentials')
  ) {
    return 'Invalid mobile number or 6-digit PIN. Please check your credentials and try again.';
  }

  if (
    message.toLowerCase().includes('already registered') ||
    message.toLowerCase().includes('user already exists')
  ) {
    return 'An account with this mobile number already exists. Please sign in instead.';
  }

  if (
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('for security purposes') ||
    status === 429
  ) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }

  if (message.toLowerCase().includes('invalid phone') || status === 400) {
    return message || 'Invalid phone number format. Please enter a valid 10-digit mobile number.';
  }

  return message || 'Authentication failed. Please check your network connection and try again.';
}

/** Pure helper — profile is complete when full_name is a non-empty string. */
function profileIsComplete(profile: CustomerProfile | null): boolean {
  return Boolean(profile?.full_name && profile.full_name.trim().length > 0);
}

export const useAuthStore = create<AuthState>((set, get) => {
  let _subscription: Subscription | null = null;

  const loadUserProfile = async (user: User | null): Promise<CustomerProfile | null> => {
    if (!user) {
      set({ profile: null, isProfileComplete: false, isProfileLoading: false });
      return null;
    }

    // Silent refresh when we already have this user's profile: never flash a loading state.
    if (!get().profile) set({ isProfileLoading: true });
    try {
      const profileData = await fetchMyProfile();
      const complete = profileIsComplete(profileData);
      set({
        profile: profileData,
        isProfileComplete: complete,
        isProfileLoading: false,
      });
      return profileData;
    } catch (err) {
      // Keep whatever we already had; a failed refresh must not wipe the profile.
      set({ isProfileLoading: false });
      return get().profile;
    }
  };

  return {
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    isProfileLoading: false,
    isProfileComplete: false,

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
          set({ session: null, user: null, profile: null, isProfileComplete: false, isLoading: false });
        });

      // Step 2: Subscribe to auth state changes
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const currentUser = session?.user ?? null;
        set({ session, user: currentUser });

        if (currentUser) {
          await loadUserProfile(currentUser);
        } else {
          set({ profile: null, isProfileComplete: false, isProfileLoading: false });
        }

        set({ isLoading: false });
      });

      _subscription = data.subscription;

      return () => {
        _subscription?.unsubscribe();
        _subscription = null;
      };
    },

    signUpWithPhonePin: async (phone: string, pin: string): Promise<AuthActionResult> => {
      try {
        const phoneVal = validateAndFormatIndianPhone(phone);
        if (!phoneVal.isValid) {
          return { success: false, error: phoneVal.error || 'Invalid phone number format.' };
        }

        const normalizedPhone = phoneVal.formattedPhone;
        const internalEmail = phoneToInternalAuthEmail(normalizedPhone);

        const { data, error } = await supabase.auth.signUp({
          email: internalEmail,
          password: pin,
          options: {
            data: {
              phone: normalizedPhone,
            },
          },
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
          error: err?.message || 'Network error while creating account.',
        };
      }
    },

    signInWithPhonePin: async (phone: string, pin: string): Promise<AuthActionResult> => {
      try {
        const phoneVal = validateAndFormatIndianPhone(phone);
        if (!phoneVal.isValid) {
          return { success: false, error: phoneVal.error || 'Invalid phone number format.' };
        }

        const normalizedPhone = phoneVal.formattedPhone;
        const internalEmail = phoneToInternalAuthEmail(normalizedPhone);

        const { data, error } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password: pin,
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
          error: err?.message || 'Network error while signing in.',
        };
      }
    },

    loadProfile: async (): Promise<CustomerProfile | null> => {
      const { user } = get();
      return loadUserProfile(user);
    },

    updateProfileName: async (fullName: string): Promise<AuthActionResult> => {
      const result = await updateMyProfile(fullName);

      if (result.success && result.profile) {
        const complete = profileIsComplete(result.profile);
        set({
          profile: result.profile,
          isProfileComplete: complete,
          isProfileLoading: false,
        });
        return { success: true };
      }

      return { success: false, error: result.error || 'Could not update profile.' };
    },

    signOut: async () => {
      await supabase.auth.signOut();
      set({
        session: null,
        user: null,
        profile: null,
        isProfileComplete: false,
        isLoading: false,
        isProfileLoading: false,
      });
    },
  };
});
