/** Customer taste profile + meal baskets (bundles). */
import { supabase } from './supabase';
import type { Product } from '../types/store';

export interface TopProduct { product_id: string; name: string; image_url: string | null; store_id: string; price: number; qty: number }
export interface Taste {
  orders: number;
  last_order_at: string | null;
  hours: number[];
  morning_orders: number;
  top_products: TopProduct[];
}
export type Slot = 'BREAKFAST' | 'SNACKS' | 'DINNER' | 'ANYTIME';
export interface Bundle {
  id: string;
  store_id: string;
  slot: Slot;
  name: string;
  description: string | null;
  items: Array<{ quantity: number; product: Product }>;
  totalPaise: number;
}

export async function fetchTaste(): Promise<Taste | null> {
  const { data, error } = await supabase.rpc('get_my_taste', { p_tz: 'Asia/Kolkata' });
  if (error || !data) return null;
  return data as Taste;
}

export async function fetchBundles(storeIds: string[]): Promise<Bundle[]> {
  if (storeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('bundles')
    .select('id,store_id,slot,name,description,bundle_items(quantity,products(*))')
    .in('store_id', storeIds)
    .eq('is_active', true)
    .limit(60);
  if (error || !data) return [];
  const out: Bundle[] = [];
  for (const row of data as unknown as Array<{ id: string; store_id: string; slot: Slot; name: string; description: string | null; bundle_items: Array<{ quantity: number; products: Product | null }> }>) {
    const items = (row.bundle_items ?? []).filter((i) => i.products && i.products.is_available && i.products.is_active).map((i) => ({ quantity: i.quantity, product: i.products as Product }));
    if (items.length < 2) continue;
    out.push({ id: row.id, store_id: row.store_id, slot: row.slot, name: row.name, description: row.description, items, totalPaise: items.reduce((s, i) => s + i.product.price * i.quantity, 0) });
  }
  return out;
}

/** Which meal is it right now (device local time)? */
export function currentSlot(d = new Date()): Slot {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'BREAKFAST';
  if (h >= 15 && h < 19) return 'SNACKS';
  if (h >= 19 && h < 23) return 'DINNER';
  return 'ANYTIME';
}

export const SLOT_LABEL: Record<Slot, string> = { BREAKFAST: 'Breakfast', SNACKS: 'Snack time', DINNER: 'Dinner', ANYTIME: 'Baskets' };
