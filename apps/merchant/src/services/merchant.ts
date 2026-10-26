import { supabase } from './supabase';
import type { Order, OrderStatus, Product, Store } from '../lib/types';

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (/network request failed|failed to fetch|timeout|offline/i.test(raw)) return 'No internet connection. Check your network and try again.';
  if (/ROLE_NOT_ALLOWED/.test(raw)) return 'You are not allowed to do that on this order.';
  if (/INVALID_ORDER_STATUS|Invalid order status transition|terminal state/i.test(raw)) return 'This order has already moved on. Pull down to refresh.';
  if (/AUTH_REQUIRED|JWT|not authenticated/i.test(raw)) return 'Your session expired. Please sign in again.';
  if (/row-level security|permission denied/i.test(raw)) return 'You do not have permission to change this.';
  return raw || 'Something went wrong. Please try again.';
}

export async function fetchMerchantStore(userId: string): Promise<Store | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('id,name,category,is_open,is_verified,address_text,phone')
    .eq('merchant_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Store | null;
}

export async function fetchOrders(storeId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,status,payment_method,payment_status,items_total,delivery_fee,total_amount,special_instructions,rejection_reason,created_at,order_items(id,product_name_snapshot,unit_price,quantity,total_price,unit_snapshot)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

export async function fetchProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id,name,unit,price,is_available,is_active,updated_at,image_url')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function transitionOrder(orderId: string, to: OrderStatus, note: string | null): Promise<void> {
  const { error } = await supabase.rpc('transition_order_status', { p_order_id: orderId, p_to_status: to, p_note: note });
  if (error) throw error;
}

export async function setProductAvailability(productId: string, available: boolean): Promise<void> {
  const { error } = await supabase.from('products').update({ is_available: available }).eq('id', productId);
  if (error) throw error;
}

export async function setProductPrice(productId: string, pricePaise: number): Promise<void> {
  const { error } = await supabase.from('products').update({ price: pricePaise }).eq('id', productId);
  if (error) throw error;
}

export async function createProduct(storeId: string, input: { name: string; unit: string; pricePaise: number; imageUrl?: string | null }): Promise<void> {
  const { error } = await supabase.from('products').insert({
    image_url: input.imageUrl ?? null,
    store_id: storeId,
    name: input.name,
    unit: input.unit,
    price: input.pricePaise,
    is_available: true,
    is_active: true,
  });
  if (error) throw error;
}

export async function setStoreOpen(storeId: string, open: boolean): Promise<void> {
  const { error } = await supabase.from('stores').update({ is_open: open }).eq('id', storeId);
  if (error) throw error;
}

export async function updateStoreDetails(storeId: string, name: string, phone: string): Promise<void> {
  const { error } = await supabase.from('stores').update({ name, phone }).eq('id', storeId);
  if (error) throw error;
}

export async function setProductImage(productId: string, url: string): Promise<void> {
  const { error } = await supabase.from('products').update({ image_url: url }).eq('id', productId);
  if (error) throw error;
}
