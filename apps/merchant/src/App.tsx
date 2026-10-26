import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import {
  createProduct, friendlyError, setProductAvailability, setProductImage, setProductPrice, setStoreOpen, transitionOrder, updateStoreDetails,
} from './services/merchant';
import { choosePhoto, uploadProductPhoto } from './services/media';
import { useMerchantData } from './hooks/useMerchantData';
import { LoginScreen } from './screens/LoginScreen';
import { PendingApprovalScreen } from './screens/PendingApprovalScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { OrderDetailScreen } from './screens/OrderDetailScreen';
import { CatalogueScreen } from './screens/CatalogueScreen';
import { StoreScreen } from './screens/StoreScreen';
import { AddProductSheet, PriceSheet, RejectSheet } from './components/sheets';
import { Banner, Button, EmptyState, Pill } from './components/ui';
import { NEW_STATUSES, rupees } from './lib/format';
import type { Order, OrderStatus, Product } from './lib/types';
import { colors, radius } from './theme';

type Tab = 'orders' | 'catalogue' | 'store';

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [roleOk, setRoleOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setSession(data.session); })
      .catch(() => { /* treated as signed out */ })
      .finally(() => { if (alive) setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) { setRoleOk(null); return; }
    let alive = true;
    supabase.from('profiles').select('role,is_active').eq('id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setRoleOk(null); return; }
        const ok = !!data && data.role === 'merchant' && data.is_active === true;
        setRoleOk(ok);
      });
    return () => { alive = false; };
  }, [userId]);

  if (checking) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  if (!session) return <LoginScreen />;
  if (roleOk === null) {
    return <View style={styles.center}><StatusBar style="dark" /><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  const phoneDigits = String(session.user.email ?? '').replace(/\D/g, '').slice(-10);
  if (!roleOk && !(session.user.user_metadata as Record<string, unknown> | undefined)?.['merchant_application']) {
    return <SignUpScreen existingPhone={phoneDigits} onBack={() => { void supabase.auth.signOut(); }} />;
  }
  if (!roleOk) return <PendingApprovalScreen phone={String(session.user.email ?? '').replace(/\D/g, '').slice(-10)} onCheck={() => { setRoleOk(null); void supabase.from('profiles').select('role,is_active').eq('id', session.user.id).maybeSingle().then(({ data }) => setRoleOk(!!data && data.role === 'merchant' && data.is_active === true)); }} />;
  return <Console userId={session.user.id} />;
}

function Console({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('orders');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [alertOrders, setAlertOrders] = useState<Order[]>([]);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [busyProducts, setBusyProducts] = useState<ReadonlySet<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [priceTarget, setPriceTarget] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [storeBusy, setStoreBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const onNewOrders = useCallback((fresh: Order[]) => {
    setAlertOrders(fresh);
    Vibration.vibrate([0, 350, 150, 350]);
  }, []);

  const { store, setStore, orders, products, setProducts, state, error, refreshing, reload } = useMerchantData({ userId, onNewOrders });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const openOrder = useMemo(() => orders.find((o) => o.id === openOrderId) ?? null, [orders, openOrderId]);
  const newCount = useMemo(() => orders.filter((o) => NEW_STATUSES.includes(o.status)).length, [orders]);
  const activeCount = useMemo(
    () => orders.filter((o) => !NEW_STATUSES.includes(o.status) && !['DELIVERED', 'REJECTED', 'CANCELLED', 'PAYMENT_FAILED', 'DELIVERY_FAILED', 'REFUND_PENDING', 'REFUNDED'].includes(o.status)).length,
    [orders],
  );

  const advance = useCallback(async (order: Order, to: OrderStatus, note: string | null = null) => {
    if (busyOrderId) return;
    setBusyOrderId(order.id);
    setActionError(null);
    try {
      await transitionOrder(order.id, to, note);
      setAlertOrders((prev) => prev.filter((o) => o.id !== order.id));
      await reload();
    } catch (e) {
      setActionError(friendlyError(e));
      await reload();
    } finally {
      setBusyOrderId(null);
    }
  }, [busyOrderId, reload]);

  const toggleProduct = useCallback(async (p: Product, available: boolean) => {
    setBusyProducts((s) => new Set(s).add(p.id));
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_available: available } : x)));
    try {
      await setProductAvailability(p.id, available);
    } catch (e) {
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_available: !available } : x)));
      setActionError(friendlyError(e));
    } finally {
      setBusyProducts((s) => { const n = new Set(s); n.delete(p.id); return n; });
    }
  }, [setProducts]);

  const savePrice = useCallback(async (paise: number) => {
    if (!priceTarget) return;
    setSheetBusy(true);
    try {
      await setProductPrice(priceTarget.id, paise);
      setPriceTarget(null);
      await reload();
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setSheetBusy(false);
    }
  }, [priceTarget, reload]);

  const addProduct = useCallback(async (v: { name: string; unit: string; pricePaise: number; photoUri: string | null }) => {
    if (!store) return;
    setSheetBusy(true);
    try {
      const imageUrl = v.photoUri ? await uploadProductPhoto(store.id, v.photoUri) : null;
      await createProduct(store.id, { name: v.name, unit: v.unit, pricePaise: v.pricePaise, imageUrl });
      setAddOpen(false);
      await reload();
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setSheetBusy(false);
    }
  }, [store, reload]);

  const editPhoto = useCallback((p: Product) => {
    if (!store) return;
    const run = async (src: 'camera' | 'library') => {
      try {
        const r = await choosePhoto(src);
        if (r.denied) { setActionError('Allow camera or photo access in your phone settings to add pictures.'); return; }
        if (!r.uri) return;
        setSheetBusy(true);
        const url = await uploadProductPhoto(store.id, r.uri);
        await setProductImage(p.id, url);
        await reload();
      } catch (e) { setActionError(friendlyError(e)); } finally { setSheetBusy(false); }
    };
    Alert.alert('Product photo', p.name, [
      { text: 'Take photo', onPress: () => { void run('camera'); } },
      { text: 'Choose from gallery', onPress: () => { void run('library'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [store, reload]);

  const saveStoreDetails = useCallback(async (name: string, phone: string) => {
    if (!store) return;
    try {
      await updateStoreDetails(store.id, name, phone);
      setStore({ ...store, name, phone });
    } catch (e) {
      setActionError(friendlyError(e));
      throw e;
    }
  }, [store, setStore]);

  const toggleOpen = useCallback(async (open: boolean) => {
    if (!store) return;
    setStoreBusy(true);
    try {
      await setStoreOpen(store.id, open);
      setStore({ ...store, is_open: open });
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setStoreBusy(false);
    }
  }, [store, setStore]);

  const alertRef = useRef(alertOrders);
  alertRef.current = alertOrders;
  const firstAlert = alertOrders[0];
  // Keep buzzing until the shopkeeper opens or dismisses the alert, so a busy shop does not miss orders.
  useEffect(() => {
    if (alertOrders.length === 0) { Vibration.cancel(); return; }
    Vibration.vibrate([0, 600, 500, 600, 1500], true);
    return () => { Vibration.cancel(); };
  }, [alertOrders.length]);

  if (state === 'loading') {
    return <View style={styles.center}><StatusBar style="dark" /><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  if (state === 'error' && !store) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <StatusBar style="dark" />
        <EmptyState icon="cloud-offline-outline" title="Could not load your store" body={error ?? 'Check your connection and try again.'} action={<Button label="Try again" onPress={() => { void reload(); }} />} />
        <Button label="Sign out" variant="ghost" onPress={() => { void supabase.auth.signOut(); }} />
      </View>
    );
  }
  if (!store) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <StatusBar style="dark" />
        <EmptyState icon="storefront-outline" title="No store linked yet" body="You are signed in, but BEVER has not linked a store to this account. Contact BEVER support to finish setup." action={<Button label="Sign out" variant="secondary" onPress={() => { void supabase.auth.signOut(); }} />} />
      </View>
    );
  }

  const showDetail = tab === 'orders' && openOrder;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      {!showDetail ? (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>BEVER MERCHANT</Text>
            <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
          </View>
          <Pill label={store.is_open ? 'Open' : 'Paused'} tone={store.is_open ? 'ok' : 'bad'} />
        </View>
      ) : null}

      {firstAlert ? (
        <Pressable
          style={styles.alert}
          accessibilityRole="button"
          onPress={() => { setTab('orders'); setOpenOrderId(firstAlert.id); setAlertOrders([]); }}
        >
          <Ionicons name="notifications" size={20} color="#FFFFFF" />
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={styles.alertTitle}>{alertOrders.length > 1 ? `${alertOrders.length} new orders` : `New order #${firstAlert.order_number}`}</Text>
            <Text style={styles.alertSub}>{alertOrders.length > 1 ? 'Tap to review' : `${rupees(firstAlert.total_amount)} · tap to review`}</Text>
          </View>
          <Pressable onPress={() => setAlertOrders([])} hitSlop={10} accessibilityLabel="Dismiss"><Ionicons name="close" size={20} color="#FFFFFF" /></Pressable>
        </Pressable>
      ) : null}

      {(actionError || (error && state === 'ready')) ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Banner message={actionError ?? error ?? ''} tone="bad" onRetry={() => { setActionError(null); void reload(); }} onDismiss={() => setActionError(null)} />
        </View>
      ) : null}

      <View style={styles.body}>
        {showDetail && openOrder ? (
          <OrderDetailScreen
            order={openOrder}
            now={now}
            busy={busyOrderId === openOrder.id}
            onBack={() => setOpenOrderId(null)}
            onAdvance={(to) => { void advance(openOrder, to); }}
            onReject={() => setRejectTarget(openOrder)}
          />
        ) : tab === 'orders' ? (
          <OrdersScreen
            orders={orders}
            loading={false}
            refreshing={refreshing}
            now={now}
            busyId={busyOrderId}
            onRefresh={() => { void reload({ pull: true }); }}
            onOpen={(o) => setOpenOrderId(o.id)}
            onAccept={(o) => { void advance(o, 'MERCHANT_ACCEPTED'); }}
            onReject={(o) => setRejectTarget(o)}
          />
        ) : tab === 'catalogue' ? (
          <CatalogueScreen
            products={products}
            loading={false}
            refreshing={refreshing}
            now={now}
            busyIds={busyProducts}
            onRefresh={() => { void reload({ pull: true }); }}
            onToggle={(p, v) => { void toggleProduct(p, v); }}
            onEditPrice={(p) => setPriceTarget(p)}
            onEditPhoto={editPhoto}
            onAdd={() => setAddOpen(true)}
          />
        ) : (
          <StoreScreen
            store={store}
            busy={storeBusy}
            activeOrders={activeCount}
            onToggleOpen={(v) => { void toggleOpen(v); }}
            onSaveDetails={saveStoreDetails}
            onSignOut={() => { void supabase.auth.signOut(); }}
          />
        )}
      </View>

      {!showDetail ? (
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TabButton icon="receipt-outline" activeIcon="receipt" label="Orders" active={tab === 'orders'} badge={newCount} onPress={() => setTab('orders')} />
          <TabButton icon="cube-outline" activeIcon="cube" label="Catalogue" active={tab === 'catalogue'} onPress={() => setTab('catalogue')} />
          <TabButton icon="storefront-outline" activeIcon="storefront" label="Store" active={tab === 'store'} onPress={() => setTab('store')} />
        </View>
      ) : null}

      <RejectSheet
        visible={!!rejectTarget}
        orderNumber={rejectTarget ? `#${rejectTarget.order_number}` : ''}
        busy={!!rejectTarget && busyOrderId === rejectTarget.id}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          const target = rejectTarget;
          if (!target) return;
          void advance(target, 'REJECTED', reason).then(() => { setRejectTarget(null); });
        }}
      />
      <PriceSheet
        visible={!!priceTarget}
        productName={priceTarget?.name ?? ''}
        currentPaise={priceTarget?.price ?? 0}
        busy={sheetBusy}
        onClose={() => setPriceTarget(null)}
        onSave={(p) => { void savePrice(p); }}
      />
      <AddProductSheet visible={addOpen} busy={sheetBusy} onClose={() => setAddOpen(false)} onSave={(v) => { void addProduct(v); }} />
    </View>
  );
}

function TabButton({ icon, activeIcon, label, active, badge, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; activeIcon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; active: boolean; badge?: number; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}>
      <View>
        <Ionicons name={active ? activeIcon : icon} size={24} color={active ? colors.brandDark : colors.muted} />
        {badge && badge > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
      </View>
      <Text style={[styles.tabLabel, active && { color: colors.brandDark }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  brand: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: colors.brandDark },
  storeName: { fontSize: 19, fontWeight: '900', color: colors.ink, marginTop: 2 },
  body: { flex: 1 },
  alert: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brandDark, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md },
  alertTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  alertSub: { color: '#A7F3D0', fontSize: 12, marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  tabLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, marginTop: 3 },
  badge: { position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
