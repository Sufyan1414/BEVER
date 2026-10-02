/**
 * BEVER Customer App — Address Type Definitions
 *
 * Types for public.customer_addresses database records and UI forms.
 */

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  /** Raw PostGIS location string or GeoJSON representation */
  location: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressInput {
  label: 'Home' | 'Work' | 'Other' | string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
}

export interface UpdateAddressInput {
  label?: 'Home' | 'Work' | 'Other' | string;
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
}

export interface AddressValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}
