import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { fetchMerchantStore, fetchOrders, fetchProducts, friendlyError } from '../services/merchant';
import type { Order, Product, Store } from '../lib/types';

export type LoadState = 'loading' | 'ready' | 'error';

interface Options {
  userId: string;
  onNewOrders: (orders: Order[]) => void;
}

export function useMerchantData({ userId, onNewOrders }: Options) {
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seenPending = useRef<Set<string>>(new Set());
  const firstLoadDone = useRef(false);
  const onNewRef = useRef(onNewOrders);
  onNewRef.current = onNewOrders;
  const storeIdRef = useRef<string | null>(null);

  const load = useCallback(async (opts?: { pull?: boolean }) => {
    if (opts?.pull) setRefreshing(true);
    try {
      const s = await fetchMerchantStore(userId);
      setStore(s);
      storeIdRef.current = s?.id ?? null;
      if (!s) {
        setOrders([]);
        setProducts([]);
        setError(null);
        setState('ready');
        return;
      }
      const [o, p] = await Promise.all([fetchOrders(s.id), fetchProducts(s.id)]);
      setOrders(o);
      setProducts(p);
      setError(null);
      setState('ready');

      const pending = o.filter((x) => x.status === 'PENDING');
      const fresh = pending.filter((x) => !seenPending.current.has(x.id));
      pending.forEach((x) => seenPending.current.add(x.id));
      if (firstLoadDone.current && fresh.length > 0) onNewRef.current(fresh);
      firstLoadDone.current = true;
    } catch (e) {
      setError(friendlyError(e));
      setState((prev) => (prev === 'ready' ? 'ready' : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const storeId = store?.id ?? null;
  useEffect(() => {
    if (!storeId) return undefined;
    const channel = supabase
      .channel(`merchant-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `store_id=eq.${storeId}` }, () => { void load(); })
      .subscribe();
    // Realtime is best-effort; the database is the source of truth, so also refresh on a timer.
    const timer = setInterval(() => { void load(); }, 30000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [storeId, load]);

  return { store, setStore, orders, products, setProducts, state, error, setError, refreshing, reload: load };
}
