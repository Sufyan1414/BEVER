import { supabase } from './supabase';

export interface Serviceability {
  ok: boolean;
  hasPin: boolean;
  distanceM: number | null;
  radiusM: number | null;
}

/** Returns null when the check cannot run (e.g. migration 033 not installed): callers then allow the order. */
export async function checkAddressServiceable(storeId: string, addressId: string): Promise<Serviceability | null> {
  const { data, error } = await supabase.rpc('check_address_serviceable', { p_store_id: storeId, p_address_id: addressId });
  if (error) return null;
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return null;
  return { ok: !!r.serviceable, hasPin: !!r.has_pin, distanceM: r.distance_meters ?? null, radiusM: r.radius_meters ?? null };
}

export async function checkPointServiceable(storeId: string, lat: number, lng: number): Promise<Serviceability | null> {
  const { data, error } = await supabase.rpc('check_point_serviceable', { p_store_id: storeId, p_lat: lat, p_lng: lng });
  if (error) return null;
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return null;
  return { ok: !!r.serviceable, hasPin: true, distanceM: r.distance_meters ?? null, radiusM: r.radius_meters ?? null };
}
