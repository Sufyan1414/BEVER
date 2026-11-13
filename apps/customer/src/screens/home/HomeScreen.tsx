/**
 * BEVER Customer App — Home Screen ("ink & paper")
 *
 * Layout, top to bottom:
 *   1. Header — delivery time + address, profile, search
 *   2. Promise strip — free delivery / pay on delivery / live tracking
 *   3. Shop by category — ALL popular categories in a fixed grid (no sideways scrolling)
 *   4. Store types — wrapped chips that filter the shop list
 *   5. Buy it again / Deals — product cards that open a product page
 *   6. Shops near you — two-column shop cards
 *
 * Rules: real data only, honest empty states, skeletons while loading.
 */

import { CartBar } from '../../components/CartBar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, FlatList, ScrollView, StyleSheet, RefreshControl, Modal, Animated, Image, useWindowDimensions } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLocationStore } from '../../stores/useLocationStore';
import { fetchNearbyStores, fetchDealProducts, fetchBuyAgain } from '../../services/store';
import { ProductCard } from '../../components/ProductCard';
import { ProductDetailSheet } from '../../components/ProductDetailSheet';
import { supabase } from '../../services/supabase';
import { BrowsingLocationPickerScreen } from '../location/BrowsingLocationPickerScreen';
import type { NearbyStore, Product, StoreCategory } from '../../types/store';
import { C, CATEGORY_STYLE } from '../../theme';

// ─── Screen state ─────────────────────────────────────────────────────────────

type HomeState =
  | { kind: 'LOADING' }
  | { kind: 'ERROR'; message: string }
  | { kind: 'NO_STORES'; lat: number; lng: number; locationLabel: string }
  | { kind: 'STORE_LIST'; lat: number; lng: number; locationLabel: string; stores: NearbyStore[] };

const ALL_KEY = 'ALL' as const;
type CategoryFilter = StoreCategory | typeof ALL_KEY;

/** What people actually shop for — each tile opens search for that need. */
const NEEDS: Array<{ label: string; emoji: string; bg: string; query: string }> = [
  { label: 'Fruits & veg', emoji: '🥦', bg: '#E6F6EE', query: 'vegetable' },
  { label: 'Milk & bread', emoji: '🥛', bg: '#E8F0FF', query: 'milk' },
  { label: 'Snacks', emoji: '🥔', bg: '#FFF4DB', query: 'chips' },
  { label: 'Cold drinks', emoji: '🥤', bg: '#FDEBE7', query: 'juice' },
  { label: 'Atta & dal', emoji: '🌾', bg: '#F5EBDD', query: 'atta' },
  { label: 'Sweets', emoji: '🍫', bg: '#FDE8F2', query: 'chocolate' },
  { label: 'Personal care', emoji: '🧼', bg: '#EFEAFF', query: 'soap' },
  { label: 'Medicines', emoji: '💊', bg: '#E3F4F7', query: 'tablet' },
];

const STORE_TYPES: Array<{ key: CategoryFilter; label: string }> = [
  { key: ALL_KEY, label: 'All shops' },
  { key: 'GROCERY', label: 'Grocery' },
  { key: 'RESTAURANT', label: 'Food' },
  { key: 'PHARMACY', label: 'Pharmacy' },
  { key: 'BAKERY', label: 'Bakery' },
  { key: 'ELECTRONICS', label: 'Electronics' },
  { key: 'CLOTHING', label: 'Fashion' },
  { key: 'STATIONERY', label: 'Stationery' },
  { key: 'HARDWARE', label: 'Hardware' },
  { key: 'PET_SUPPLIES', label: 'Pet care' },
];

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

const etaOf = (st: NearbyStore) => st.estimated_delivery_minutes ?? Math.round(10 + (st.distance_meters / 1000) * 4);

// ─── Pieces ───────────────────────────────────────────────────────────────────

function SkeletonBlock({ style }: { style: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });
  return <Animated.View style={[{ backgroundColor: C.line }, style, { opacity }]} />;
}

function ShopCard({ store, thumb, width, onPress }: { store: NearbyStore; thumb: { images: string[]; count: number } | undefined; width: number; onPress: () => void }) {
  const cs = CATEGORY_STYLE[store.category] ?? CATEGORY_STYLE.OTHER!;
  const img = store.banner_url ?? thumb?.images[0] ?? null;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[shop.card, { width }]} accessibilityRole="button" accessibilityLabel={`Open ${store.name}`}>
      <View style={[shop.media, { backgroundColor: cs.bg }]}>
        {img ? <Image source={{ uri: img }} style={shop.img} resizeMode="cover" /> : <Text style={{ fontSize: 40 }}>{cs.icon}</Text>}
        <View style={shop.eta}><Text style={shop.etaText}>⚡ {etaOf(store)} min</Text></View>
        {!store.is_open ? <View style={shop.veil}><Text style={shop.veilText}>Closed now</Text></View> : null}
      </View>
      <View style={shop.body}>
        <Text style={shop.name} numberOfLines={1}>{store.name}</Text>
        <View style={shop.row}>
          <View style={[shop.tag, { backgroundColor: cs.bg }]}><Text style={[shop.tagText, { color: cs.fg }]}>{cs.label}</Text></View>
          <Text style={shop.meta} numberOfLines={1}>{formatDistance(store.distance_meters)}</Text>
          {store.total_ratings > 0 ? <Text style={shop.rate}>★ {store.average_rating.toFixed(1)}</Text> : null}
        </View>
        {thumb && thumb.count > 0 ? <Text style={shop.count}>{thumb.count} items</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const shop = StyleSheet.create({
  card: { backgroundColor: C.paper, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden', marginBottom: 12 },
  media: { height: 104, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  eta: { position: 'absolute', left: 8, bottom: 8, backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  etaText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', justifyContent: 'center' },
  veilText: { fontSize: 12, fontWeight: '800', color: C.muted },
  body: { padding: 10, gap: 5 },
  name: { fontSize: 14, fontWeight: '800', color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800' },
  meta: { fontSize: 11, color: C.muted, fontWeight: '600', flexShrink: 1 },
  rate: { fontSize: 11, color: C.ink, fontWeight: '800' },
  count: { fontSize: 10.5, color: C.faint, fontWeight: '600' },
});

function SectionHead({ title, sub, action, onAction }: { title: string; sub?: string | undefined; action?: string | undefined; onAction?: (() => void) | undefined }) {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      {action ? <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={styles.sectionAction}>{action} ›</Text></TouchableOpacity> : null}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { session } = useAuthStore();
  const { browsingLocation } = useLocationStore();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: winW } = useWindowDimensions();

  const isAuthenticated = session !== null;
  const insets = useSafeAreaInsets();

  const [homeState, setHomeState] = useState<HomeState>({ kind: 'LOADING' });
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(ALL_KEY);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ product: Product; store: NearbyStore } | null>(null);

  useEffect(() => {
    const q = route.params?.query;
    const cat = route.params?.category;
    if (typeof q === 'string' && q.length > 0) setPendingQuery(q);
    else if (route.params?.search === true) setPendingQuery('');
    if (typeof cat === 'string' && cat.length > 0) setSelectedCategory(cat as CategoryFilter);
    if (q || cat || route.params?.search) navigation.setParams({ query: undefined, category: undefined, search: undefined });
  }, [route.params, navigation]);

  const [deals, setDeals] = useState<Product[]>([]);
  const [buyAgain, setBuyAgain] = useState<Product[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, { images: string[]; count: number }>>({});

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const listRef = useRef<FlatList<NearbyStore>>(null);
  const [showChangeLocation, setShowChangeLocation] = useState(false);
  const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  // Discovery is driven only by the browsing location (a saved address belongs to checkout).
  const loadStores = useCallback(async () => {
    if (isMounted.current) setHomeState({ kind: 'LOADING' });
    if (!browsingLocation) { setHomeState({ kind: 'NO_STORES', lat: 0, lng: 0, locationLabel: '' }); return; }
    const { lat, lng, label } = browsingLocation;
    try {
      const stores = await fetchNearbyStores(lat, lng);
      if (!isMounted.current) return;
      setHomeState(stores.length === 0
        ? { kind: 'NO_STORES', lat, lng, locationLabel: label }
        : { kind: 'STORE_LIST', lat, lng, locationLabel: label, stores });
    } catch (err: any) {
      if (isMounted.current) setHomeState({ kind: 'ERROR', message: err?.message || 'Could not load shops.' });
    }
  }, [browsingLocation]);

  useEffect(() => { void loadStores(); }, [loadStores]);

  useEffect(() => {
    const ids = homeState.kind === 'STORE_LIST' ? homeState.stores.map((st) => st.id) : [];
    if (ids.length === 0) return;
    let alive = true;
    supabase.from('products').select('store_id,image_url').in('store_id', ids).eq('is_available', true).limit(400).then(({ data }) => {
      if (!alive || !data) return;
      const out: Record<string, { images: string[]; count: number }> = {};
      for (const r of data as Array<{ store_id: string; image_url: string | null }>) {
        const e = (out[r.store_id] ??= { images: [], count: 0 });
        e.count += 1;
        if (r.image_url && e.images.length < 4) e.images.push(r.image_url);
      }
      setThumbs(out);
    }, () => undefined);
    return () => { alive = false; };
  }, [homeState]);

  useEffect(() => {
    const ids = homeState.kind === 'STORE_LIST' ? homeState.stores.map((st) => st.id) : [];
    if (ids.length === 0) { setDeals([]); return; }
    let alive = true;
    fetchDealProducts(ids).then((rows) => { if (alive) setDeals(rows); }).catch(() => undefined);
    if (isAuthenticated) fetchBuyAgain(ids).then((rows) => { if (alive) setBuyAgain(rows); }).catch(() => undefined);
    else setBuyAgain([]);
    return () => { alive = false; };
  }, [homeState, isAuthenticated]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStores();
    setIsRefreshing(false);
  }, [loadStores]);

  const handleChangeLocation = useCallback(() => setShowChangeLocation(true), []);
  const handleLocationChanged = useCallback(() => { setShowChangeLocation(false); void loadStores(); }, [loadStores]);

  const allStores: NearbyStore[] = homeState.kind === 'STORE_LIST' ? homeState.stores : [];
  const visibleStores = selectedCategory === ALL_KEY ? allStores : allStores.filter((st) => st.category === selectedCategory);
  const countFor = (k: CategoryFilter) => (k === ALL_KEY ? allStores.length : allStores.filter((st) => st.category === k).length);

  const openSearch = useCallback((query?: string) => {
    navigation.navigate('Search', { stores: allStores, query });
  }, [navigation, allStores]);

  useEffect(() => {
    if (pendingQuery !== null && homeState.kind === 'STORE_LIST') {
      openSearch(pendingQuery || undefined);
      setPendingQuery(null);
    }
  }, [pendingQuery, homeState.kind, openSearch]);

  const nearestOpen = allStores.filter((st) => st.is_open).sort((a, b) => a.distance_meters - b.distance_meters)[0] ?? null;
  const locationLabel = (homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES') ? homeState.locationLabel : (browsingLocation?.label ?? '');
  const storeFor = (id: string) => allStores.find((st) => st.id === id);
  const openShop = (st: NearbyStore, focusProductId?: string) => navigation.navigate('StoreDetail', { store: st, ...(focusProductId ? { focusProductId } : {}) });

  const gutter = 16;
  const cardW = Math.floor((winW - gutter * 2 - 12) / 2);
  const dealW = 150;
  const tileW = Math.floor((winW - gutter * 2 - 10 * 3) / 4);

  const productRow = (rows: Product[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 10, paddingBottom: 6 }}>
      {rows.map((p) => {
        const st = storeFor(p.store_id);
        if (!st) return null;
        return <ProductCard key={p.id} product={p} width={dealW} storeName={st.name} storeCategory={st.category} etaMinutes={etaOf(st)} onOpen={() => setSheet({ product: p, store: st })} />;
      })}
    </ScrollView>
  );

  const header = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={handleChangeLocation} accessibilityLabel="Change delivery location" activeOpacity={0.8}>
            <Text style={styles.eta}>{nearestOpen ? `Delivery in ${etaOf(nearestOpen)} minutes` : 'Delivery to your door'}</Text>
            <View style={styles.locRow}>
              <Ionicons name="location-sharp" size={15} color={C.ink} />
              <Text style={styles.locText} numberOfLines={1}>{locationLabel || 'Set your location'}</Text>
              <Ionicons name="chevron-down" size={15} color={C.ink} />
            </View>
          </TouchableOpacity>
          {isAuthenticated ? (
            <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Profile')} accessibilityLabel="Open profile">
              <Ionicons name="person" size={19} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.signIn} onPress={() => navigation.navigate('Auth')} accessibilityLabel="Sign in">
              <Text style={styles.signInText}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={() => openSearch()} style={styles.search} accessibilityRole="search" accessibilityLabel="Search shops and products">
          <Ionicons name="search" size={19} color={C.ink} />
          <Text style={styles.searchText} numberOfLines={1}>Search “milk”, “paracetamol”, “earphones”…</Text>
        </TouchableOpacity>
      </View>

      {homeState.kind === 'STORE_LIST' ? (
        <View>
          <View style={[styles.promo, { marginHorizontal: gutter }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoKicker}>FREE DELIVERY</Text>
              <Text style={styles.promoTitle}>On orders above ₹199</Text>
              <Text style={styles.promoSub}>Pay cash when it arrives. Track your rider live.</Text>
            </View>
            <View style={styles.promoBadge}><Text style={{ fontSize: 30 }}>🛵</Text></View>
          </View>

          <SectionHead title="Shop by category" sub="Tap to search everything nearby" action="See all" onAction={() => navigation.navigate('Categories')} />
          <View style={[styles.grid, { paddingHorizontal: gutter }]}>
            {NEEDS.map((n) => (
              <TouchableOpacity key={n.label} activeOpacity={0.85} onPress={() => openSearch(n.query)} style={{ width: tileW }} accessibilityRole="button" accessibilityLabel={`Shop ${n.label}`}>
                <View style={[styles.tile, { backgroundColor: n.bg, height: tileW }]}><Text style={{ fontSize: Math.round(tileW * 0.46) }}>{n.emoji}</Text></View>
                <Text style={styles.tileLabel} numberOfLines={2}>{n.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {buyAgain.length > 0 && selectedCategory === ALL_KEY ? (<><SectionHead title="Buy it again" sub="Your usual picks, one tap away" />{productRow(buyAgain)}</>) : null}
          {deals.length > 0 && selectedCategory === ALL_KEY ? (<><SectionHead title="Deals for you" sub="Biggest savings from shops nearby" />{productRow(deals)}</>) : null}
        </View>
      ) : null}

      {(homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES') ? (
        <View>
          <SectionHead title={homeState.kind === 'STORE_LIST' ? 'Shops near you' : 'No shops found'} sub={homeState.kind === 'STORE_LIST' ? `${visibleStores.length} shop${visibleStores.length === 1 ? '' : 's'} deliver to you · each shop is its own basket` : undefined} />
          {homeState.kind === 'STORE_LIST' ? (
            <View style={styles.chipWrap}>
              {STORE_TYPES.filter((t) => t.key === ALL_KEY || countFor(t.key) > 0).map((t) => {
                const on = selectedCategory === t.key;
                return (
                  <TouchableOpacity key={t.key} onPress={() => setSelectedCategory(t.key)} style={[styles.chip, on && styles.chipOn]} activeOpacity={0.85} accessibilityLabel={`Show ${t.label}`}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
                    <Text style={[styles.chipCount, on && styles.chipTextOn]}>{countFor(t.key)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="dark" />

      <Modal visible={showChangeLocation} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowChangeLocation(false)}>
        <BrowsingLocationPickerScreen isChanging onLocationSet={handleLocationChanged} />
      </Modal>

      <ProductDetailSheet
        product={sheet?.product ?? null}
        store={sheet ? { id: sheet.store.id, name: sheet.store.name, category: sheet.store.category, etaMinutes: etaOf(sheet.store) } : null}
        onClose={() => setSheet(null)}
        onViewShop={sheet ? () => { const cur = sheet; setSheet(null); openShop(cur.store, cur.product.id); } : undefined}
      />

      {homeState.kind === 'LOADING' && !isRefreshing ? (
        <View>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <SkeletonBlock style={{ height: 22, width: 190, borderRadius: 8 }} />
            <SkeletonBlock style={{ height: 14, width: 130, borderRadius: 6, marginTop: 8 }} />
            <SkeletonBlock style={{ height: 48, borderRadius: 16, marginTop: 14 }} />
          </View>
          <View style={[styles.grid, { paddingHorizontal: gutter, marginTop: 20 }]}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} style={{ width: tileW, height: tileW, borderRadius: 18 }} />)}
          </View>
        </View>
      ) : null}

      {homeState.kind === 'ERROR' ? (
        <View style={styles.errorState}>
          <Text style={{ fontSize: 48, marginBottom: 14 }}>📡</Text>
          <Text style={styles.errorTitle}>Couldn't load shops</Text>
          <Text style={styles.errorBody}>{homeState.message}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => void loadStores()}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : null}

      {(homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES') ? (
        <FlatList
          ref={listRef}
          onScroll={(e) => { const hit = e.nativeEvent.contentOffset.y > 320; if (hit !== scrolledRef.current) { scrolledRef.current = hit; setScrolled(hit); } }}
          scrollEventThrottle={32}
          data={visibleStores}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: gutter, justifyContent: 'space-between' }}
          renderItem={({ item }) => <ShopCard store={item} thumb={thumbs[item.id]} width={cardW} onPress={() => openShop(item)} />}
          contentContainerStyle={{ paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={C.ink} />}
          ListHeaderComponent={header}
          ListFooterComponent={visibleStores.length > 0 ? (
            <View style={styles.footerWrap}>
              <Text style={styles.footerBrand}>BEVER</Text>
              <Text style={styles.footerLine}>Fresh from the shops around the corner</Text>
            </View>
          ) : null}
          ListEmptyComponent={
            selectedCategory !== ALL_KEY && homeState.kind === 'STORE_LIST' ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 40 }}>🔍</Text>
                <Text style={styles.emptyTitle}>No {CATEGORY_STYLE[selectedCategory]?.label.toLowerCase() ?? 'such'} shops nearby</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setSelectedCategory(ALL_KEY)}><Text style={styles.emptyBtnText}>Show all shops</Text></TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={{ fontSize: 40 }}>🏪</Text>
                <Text style={styles.emptyTitle}>No shops here yet</Text>
                <Text style={styles.emptyBody}>No BEVER shops deliver {locationLabel ? `near “${locationLabel}”` : 'to your area'} yet. New shops join often.</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={handleChangeLocation}><Text style={styles.emptyBtnText}>Try a different location</Text></TouchableOpacity>
              </View>
            )
          }
        />
      ) : null}

      {scrolled && homeState.kind === 'STORE_LIST' ? (
        <TouchableOpacity onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} style={styles.topPill} activeOpacity={0.9} accessibilityLabel="Back to top">
          <Text style={styles.topPillText}>↑  Back to top</Text>
        </TouchableOpacity>
      ) : null}
      <CartBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: { paddingHorizontal: 16, paddingBottom: 14, backgroundColor: C.paper },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eta: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locText: { fontSize: 13, fontWeight: '600', color: C.ink2, flexShrink: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  signIn: { backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  signInText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.canvas, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, height: 50, marginTop: 14 },
  searchText: { flex: 1, fontSize: 14, color: C.muted, fontWeight: '500' },
  promo: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.ink, borderRadius: 24, padding: 18, marginTop: 4 },
  promoKicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6, color: C.saffron },
  promoTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.3 },
  promoSub: { fontSize: 12, color: '#B8B8B2', marginTop: 4, lineHeight: 17 },
  promoBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#1D1D20', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 22, paddingBottom: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  sectionSub: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  sectionAction: { fontSize: 13, fontWeight: '800', color: C.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, rowGap: 14 },
  tile: { borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 11.5, fontWeight: '700', color: C.ink, textAlign: 'center', marginTop: 6, lineHeight: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 12.5, fontWeight: '700', color: C.ink },
  chipCount: { fontSize: 11, fontWeight: '800', color: C.faint },
  chipTextOn: { color: '#fff' },
  footerWrap: { alignItems: 'center', paddingTop: 24 },
  footerBrand: { fontSize: 34, fontWeight: '800', color: C.line, letterSpacing: 8 },
  footerLine: { fontSize: 12.5, color: C.muted, marginTop: 4 },
  topPill: { position: 'absolute', alignSelf: 'center', bottom: 96, backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, elevation: 6 },
  topPillText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 8 },
  errorBody: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  retry: { backgroundColor: C.ink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  retryText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  empty: { alignItems: 'center', paddingHorizontal: 36, paddingVertical: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.ink, marginTop: 10 },
  emptyBody: { fontSize: 13.5, color: C.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  emptyBtn: { marginTop: 18, backgroundColor: C.ink, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
