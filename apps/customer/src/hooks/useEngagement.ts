/**
 * Customer engagement: (1) plan the daily morning message from the customer's own taste,
 * (2) alert on order status changes while the app is alive, (3) open the right basket when a
 * notification is tapped.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { useLocationStore } from '../stores/useLocationStore';
import { useNudgeStore } from '../stores/useNudgeStore';
import { fetchNearbyStores } from '../services/store';
import { fetchBundles, fetchTaste } from '../services/taste';
import { planMorningNudge } from '../services/morning';
import { getMorningEnabled, notifyNow, Notifications, scheduleMorning } from '../services/notifications';
import { supabase } from '../services/supabase';

const STATUS_COPY: Record<string, [string, string]> = {
  MERCHANT_ACCEPTED: ['Shop accepted your order ✓', 'They are getting your items ready.'],
  PREPARING: ['Packing your order', 'Your items are being packed now.'],
  RIDER_ASSIGNED: ['Rider assigned 🛵', 'Your rider is heading to the shop.'],
  PICKED_UP: ['Rider has your order', 'On the way to you.'],
  OUT_FOR_DELIVERY: ['Out for delivery 🛵', 'Keep your delivery PIN ready.'],
  DELIVERED: ['Delivered ✓', 'Enjoy! Tap to rate your order.'],
  REJECTED: ['Shop could not take this order', 'Nothing was charged. Try another shop.'],
  CANCELLED: ['Order cancelled', 'Your order has been cancelled.'],
};

export function useEngagement() {
  const session = useAuthStore((s) => s.session);
  const browsing = useLocationStore((s) => s.browsingLocation);
  const planned = useRef<string>('');

  // 1. Morning plan (re-planned each time the app opens or the location changes).
  useEffect(() => {
    if (Platform.OS === 'web' || !browsing) return;
    const key = `${session?.user.id ?? 'guest'}:${browsing.lat.toFixed(3)}:${browsing.lng.toFixed(3)}`;
    if (planned.current === key) return;
    planned.current = key;
    let alive = true;
    (async () => {
      if (!(await getMorningEnabled())) return;
      const stores = await fetchNearbyStores(browsing.lat, browsing.lng);
      if (!alive || stores.length === 0) return;
      const [taste, bundles] = await Promise.all([session ? fetchTaste() : Promise.resolve(null), fetchBundles(stores.map((s) => s.id))]);
      if (!alive) return;
      const names = Object.fromEntries(stores.map((s) => [s.id, s.name]));
      await scheduleMorning(planMorningNudge(taste, bundles, names));
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [session, browsing]);

  // 2. Order status alerts.
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid || Platform.OS === 'web') return;
    const ch = supabase.channel(`cust-orders-${uid}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${uid}` },
      (payload) => {
        const next = (payload.new as { status?: string; id?: string }).status;
        const prev = (payload.old as { status?: string }).status;
        const copy = next ? STATUS_COPY[next] : undefined;
        if (copy && next !== prev) void notifyNow(copy[0], copy[1], { kind: 'order', orderId: String((payload.new as { id?: string }).id ?? '') });
      },
    ).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [uid]);

  // 3. Notification tap → open the basket.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (data: Record<string, unknown> | undefined) => {
      if (data && data.kind === 'bundle' && typeof data.bundleId === 'string') useNudgeStore.getState().openBundle(data.bundleId);
    };
    void Notifications.getLastNotificationResponseAsync().then((r) => { if (r) handle(r.notification.request.content.data); }).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => handle(r.notification.request.content.data));
    return () => sub.remove();
  }, []);
}
