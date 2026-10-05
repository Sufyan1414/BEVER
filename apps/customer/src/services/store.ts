/**
 * BEVER Customer App — Store Service
 *
 * Calls the public.get_nearby_stores() Postgres RPC to discover stores that
 * service a given customer delivery coordinate.
 *
 * Security & Data Rules:
 *   - Uses the canonical Supabase client singleton (./supabase). No second client.
 *   - Coordinates must be supplied by the caller from a trusted source
 *     (the authenticated customer's saved address). This function never
 *     invents, substitutes, or validates coordinates — callers must ensure
 *     they have a real coordinate before calling.
 *   - Follows the same error-handling convention as profile.ts and address.ts:
 *     throws Error on failure, returns typed data on success.
 *   - Callable by both anon and authenticated sessions (the RPC grants both).
 *     In practice the Home screen only calls this when a coordinate is known,
 *     which requires a saved address, which requires authentication.
 */

import { supabase } from './supabase';
import type { NearbyStore, ProductCategory, Product } from '../types/store';

/**
 * Fetches stores that service the given delivery coordinate.
 *
 * @param lat  Customer latitude  (WGS84, decimal degrees, -90 to 90)
 * @param lng  Customer longitude (WGS84, decimal degrees, -180 to 180)
 * @param limit  Maximum stores to return (1–200, default 50)
 * @returns Array of nearby stores sorted nearest-first, or empty array when
 *          no stores service the location.
 * @throws  Error when the Supabase RPC call fails.
 */
export async function fetchNearbyStores(
  lat: number,
  lng: number,
  limit: number = 50,
): Promise<NearbyStore[]> {
  const { data, error } = await supabase.rpc('get_nearby_stores', {
    customer_lat: lat,
    customer_lng: lng,
    limit_count:  limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as NearbyStore[];
}

/**
 * Fetches active product categories for a specific store.
 */
export async function fetchStoreCategories(storeId: string): Promise<ProductCategory[]> {
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductCategory[];
}

/**
 * Fetches active products for a specific store.
 */
export async function fetchStoreProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Product[];
}

