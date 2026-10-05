/**
 * BEVER Customer App — Browsing Location Store
 *
 * Manages the customer's selected browsing/discovery location.
 * This is SEPARATE from:
 *   - auth state (useAuthStore)
 *   - saved delivery addresses (public.customer_addresses)
 *
 * Purpose:
 *   The browsing location is where the customer wants to DISCOVER stores.
 *   It is stored locally on-device via AsyncStorage — no Supabase row needed.
 *   It is asked ONCE on first launch and persisted until explicitly changed.
 *
 * Key distinctions:
 *   browsingLocation  — where the customer is browsing/looking for stores (this store)
 *   deliveryAddress   — the saved address for an actual order (customer_addresses table)
 *
 * Rules:
 *   - No fake locations, no hardcoded cities.
 *   - GPS is offered but optional; manual map selection is always available.
 *   - Both guests and authenticated users have a browsing location.
 *   - Never writes to Supabase — purely local.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@bever/browsing_location';

export interface BrowsingLocation {
  lat: number;
  lng: number;
  /** Human-readable label (area / city name) */
  label: string;
  /** ISO timestamp of when this was set */
  setAt: string;
  /** House / Flat / Shop Number */
  houseNo?: string;
  /** Floor */
  floor?: string;
  /** Building / Society */
  building?: string;
  /** Landmark */
  landmark?: string;
  /** Delivery instructions */
  instructions?: string;
}

interface LocationState {
  /** Current browsing location, or null if not yet selected */
  browsingLocation: BrowsingLocation | null;
  /** True while loading persisted location from AsyncStorage on app start */
  isLocationLoading: boolean;
  /** True if the location picker should be shown (first launch or no location set) */
  needsLocationSetup: boolean;

  /** Load persisted location from AsyncStorage — call once on app init */
  loadPersistedLocation: () => Promise<void>;
  /** Save a new browsing location and persist it */
  setBrowsingLocation: (location: BrowsingLocation) => Promise<void>;
  /** Clear the current location (forces the picker to show again) */
  clearBrowsingLocation: () => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
  browsingLocation: null,
  isLocationLoading: true,
  needsLocationSetup: false,

  loadPersistedLocation: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BrowsingLocation;
        // Basic sanity check on persisted data
        if (
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number' &&
          isFinite(parsed.lat) &&
          isFinite(parsed.lng) &&
          parsed.lat >= -90 &&
          parsed.lat <= 90 &&
          parsed.lng >= -180 &&
          parsed.lng <= 180
        ) {
          set({ browsingLocation: parsed, isLocationLoading: false, needsLocationSetup: false });
          return;
        }
      }
      // No valid persisted location — show the picker
      set({ browsingLocation: null, isLocationLoading: false, needsLocationSetup: true });
    } catch {
      // AsyncStorage read error — show picker to be safe
      set({ browsingLocation: null, isLocationLoading: false, needsLocationSetup: true });
    }
  },

  setBrowsingLocation: async (location: BrowsingLocation) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    } catch {
      // Persist failure is non-fatal — location is still set in memory for this session
    }
    set({ browsingLocation: location, needsLocationSetup: false });
  },

  clearBrowsingLocation: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Non-fatal
    }
    set({ browsingLocation: null, needsLocationSetup: true });
  },
}));
