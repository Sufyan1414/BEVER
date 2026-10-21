/**
 * BEVER Customer App — Address Service
 *
 * Provides safe, scoped database operations for public.customer_addresses.
 *
 * Security & Data Rules:
 *   - Operating user is derived ONLY from the active Supabase session (auth.uid()).
 *   - Never accepts customer_id from UI input.
 *   - Uses canonical Supabase client singleton (`./supabase`).
 *   - Handles Indian address validation (6-digit pincode, required fields).
 *   - Supports PostGIS Point WGS84 formatting (`POINT(lng lat)`).
 */

import { supabase } from './supabase';
import type {
  CustomerAddress,
  CreateAddressInput,
  UpdateAddressInput,
  AddressValidationResult,
} from '../types/address';

/**
 * Validates Indian delivery address fields.
 */
export function validateIndianAddress(
  input: Partial<CreateAddressInput>
): AddressValidationResult {
  const errors: Record<string, string> = {};

  const line1 = input.address_line_1?.trim() || '';
  if (!line1) {
    errors['address_line_1'] = 'Street address / Flat / Building is required.';
  }

  const city = input.city?.trim() || '';
  if (!city) {
    errors['city'] = 'City is required.';
  }

  const state = input.state?.trim() || '';
  if (!state) {
    errors['state'] = 'State is required.';
  }

  const pincode = input.pincode?.trim() || '';
  if (!pincode) {
    errors['pincode'] = 'Pincode is required.';
  } else if (!/^\d{6}$/.test(pincode)) {
    errors['pincode'] = 'Pincode must be exactly 6 digits.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Formats latitude and longitude numbers into a PostGIS WKT Point string.
 * PostGIS axis order is (longitude latitude).
 */
export function formatPostGISPoint(lat?: number | null, lng?: number | null): string | null {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return null;
  }
  return `POINT(${lng} ${lat})`;
}

/**
 * Parses a PostGIS WKT Point string ("POINT(longitude latitude)") into latitude and longitude numbers.
 */
export function parseLocationPoint(
  wkt: string | null | undefined
): { lat: number; lng: number } | null {
  if (!wkt) return null;
  const match = wkt.match(/^POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)$/i);
  if (!match) return null;
  const lng = parseFloat(match[1]!);
  const lat = parseFloat(match[2]!);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}


/**
 * Fetches all saved addresses for the authenticated customer.
 */
export async function fetchMyAddresses(): Promise<CustomerAddress[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as CustomerAddress[];
}

/**
 * Fetches the default delivery address for the authenticated customer.
 */
export async function fetchDefaultAddress(): Promise<CustomerAddress | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', user.id)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CustomerAddress | null;
}

/**
 * Materializes the previously selected guest browsing location into the
 * authenticated customer's default delivery address. This prevents checkout
 * from asking for the same delivery details again after sign-in.
 */
export async function ensureDefaultAddressFromBrowsingLocation(location: {
  lat: number;
  lng: number;
  label: string;
  city?: string;
  state?: string;
  pincode?: string;
  houseNo?: string;
  floor?: string;
  building?: string;
  landmark?: string;
  instructions?: string;
}): Promise<CustomerAddress | null> {
  const existing = await fetchDefaultAddress();
  if (existing) return existing;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const city = location.city?.trim() || '';
  const state = location.state?.trim() || '';
  const pincode = location.pincode?.trim() || '';
  if (!city || !state || !/^\d{6}$/.test(pincode)) {
    return null;
  }

  const addressLine1 = [location.houseNo, location.building].filter(Boolean).join(', ') || location.label;
  const addressLine2 = [location.floor, location.landmark, location.instructions]
    .filter(Boolean)
    .join(' • ') || null;

  return createAddress({
    label: 'Home',
    address_line_1: addressLine1,
    address_line_2: addressLine2,
    city,
    state,
    pincode,
    latitude: location.lat,
    longitude: location.lng,
    is_default: true,
  });
}

/**
 * Creates a new customer address record in public.customer_addresses.
 */
export async function createAddress(input: CreateAddressInput): Promise<CustomerAddress> {
  const validation = validateIndianAddress(input);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    throw new Error(firstError || 'Invalid address data.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User session expired. Please sign in again.');
  }

  // Check existing addresses for this customer
  const existingAddresses = await fetchMyAddresses();
  const shouldBeDefault = input.is_default || existingAddresses.length === 0;

  // If setting as default, clear existing default flags for this customer
  if (shouldBeDefault && existingAddresses.length > 0) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', user.id);
  }

  const locationPoint = formatPostGISPoint(input.latitude, input.longitude);

  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({
      customer_id: user.id,
      label: input.label || 'Home',
      address_line_1: input.address_line_1.trim(),
      address_line_2: input.address_line_2?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode.trim(),
      location: locationPoint,
      is_default: shouldBeDefault,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CustomerAddress;
}

/**
 * Updates an existing customer address.
 */
export async function updateAddress(
  id: string,
  input: UpdateAddressInput
): Promise<CustomerAddress> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User session expired. Please sign in again.');
  }

  // If setting as default, clear existing defaults first
  if (input.is_default === true) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', user.id);
  }

  const updatePayload: Record<string, any> = {};
  if (input.label !== undefined) updatePayload['label'] = input.label;
  if (input.address_line_1 !== undefined) updatePayload['address_line_1'] = input.address_line_1.trim();
  if (input.address_line_2 !== undefined) updatePayload['address_line_2'] = input.address_line_2?.trim() || null;
  if (input.city !== undefined) updatePayload['city'] = input.city.trim();
  if (input.state !== undefined) updatePayload['state'] = input.state.trim();
  if (input.pincode !== undefined) updatePayload['pincode'] = input.pincode.trim();
  if (input.is_default !== undefined) updatePayload['is_default'] = input.is_default;

  if (input.latitude !== undefined || input.longitude !== undefined) {
    updatePayload['location'] = formatPostGISPoint(input.latitude, input.longitude);
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .update(updatePayload)
    .eq('id', id)
    .eq('customer_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CustomerAddress;
}

/**
 * Sets a specific address as the default delivery address.
 */
export async function setDefaultAddress(id: string): Promise<CustomerAddress> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User session expired. Please sign in again.');
  }

  // Unset all existing defaults for this customer
  await supabase
    .from('customer_addresses')
    .update({ is_default: false })
    .eq('customer_id', user.id);

  // Set default flag on target address
  const { data, error } = await supabase
    .from('customer_addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('customer_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CustomerAddress;
}

/**
 * Deletes a customer address. Promotes another address to default if needed.
 */
export async function deleteAddress(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User session expired. Please sign in again.');
  }

  const addresses = await fetchMyAddresses();
  const target = addresses.find((a) => a.id === id);

  if (!target) {
    throw new Error('Address not found.');
  }

  // Execute deletion
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', id)
    .eq('customer_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  // If the deleted address was default, promote another address to default
  if (target.is_default) {
    const remaining = addresses.filter((a) => a.id !== id);
    const firstRemaining = remaining[0];
    if (firstRemaining) {
      await setDefaultAddress(firstRemaining.id);
    }
  }
}
