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



export interface ProductHit {
  id: string;
  name: string;
  unit: string | null;
  price: number; // paise
  image_url: string | null;
  store_id: string;
}

/** Searches real products of the given (already serviceable) stores. Never invents matches. */
export async function searchProducts(storeIds: string[], query: string): Promise<ProductHit[]> {
  const q = query.trim().replace(/[%_,()]/g, ' ').trim();
  if (q.length < 2 || storeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select('id,name,unit,price,image_url,store_id')
    .in('store_id', storeIds)
    .eq('is_active', true)
    .eq('is_available', true)
    .ilike('name', `%${q}%`)
    .order('name', { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductHit[];
}

export interface DealProduct extends Product {
  store_id: string;
}

/** Discounted / popular products across the given stores, for home rows. */
export async function fetchDealProducts(storeIds: string[], limit = 16): Promise<Product[]> {
  if (storeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('store_id', storeIds)
    .eq('is_active', true)
    .eq('is_available', true)
    .not('compare_at_price', 'is', null)
    .not('image_url', 'is', null)
    .limit(60);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Product[]).filter((p) => p.compare_at_price != null && p.compare_at_price > p.price);
  rows.sort((a, b) => (b.compare_at_price! - b.price) / b.compare_at_price! - (a.compare_at_price! - a.price) / a.compare_at_price!);
  return rows.slice(0, limit);
}

/** Full product rows for search results. */
export async function searchProductsFull(storeIds: string[], query: string): Promise<Product[]> {
  const q = query.trim().replace(/[%_,()]/g, ' ').trim();
  if (q.length < 2 || storeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('store_id', storeIds)
    .eq('is_active', true)
    .ilike('name', `%${q}%`)
    .order('is_available', { ascending: false })
    .order('name', { ascending: true })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}
